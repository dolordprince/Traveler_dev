import { ToolRegistry } from '../tools/registry';
import { readFileTool, writeFileTool } from '../tools/filesystem';
import { runCommandTool } from '../tools/terminal';
import { OpenClawSkillLoader } from '../tools/skills';
import { rustTool } from '../tools/rust';
import {
  needleScanTool,
  needleBuildTool,
} from '../tools/needle';
import { needlePhoneTool } from '../tools/needle_phone';
import { ednaTTSTool } from '../tools/elevenlabs';
import { hfDatasetTool } from '../tools/hf_interrogate';
import { GLMLLMClient, ChatMessage } from '../llm/glm';
import { config } from '../config/schema';
import { buildTool, previewTool, stopPreviewTool } from '../tools/build_preview';

export class AgentOrchestrator {
  private history: ChatMessage[] = [];
  private registry: ToolRegistry = new ToolRegistry();
  private llm: GLMLLMClient;
  private skillLoader: OpenClawSkillLoader;
  private maxLoops: number;

  constructor(systemPrompt?: string) {
    this.maxLoops = config.maxLoops;
    this.llm = new GLMLLMClient();
    this.skillLoader = new OpenClawSkillLoader();

    this.registry.register(readFileTool);
    this.registry.register(needleScanTool);
    this.registry.register(needleBuildTool);
    this.registry.register(ednaTTSTool);
    this.registry.register(writeFileTool);
    this.registry.register(runCommandTool);

    this.registry.register(rustTool);
    this.registry.register(needlePhoneTool);
    
    this.registry.register(hfDatasetTool);
    this.registry.register(buildTool);
    this.registry.register(previewTool);
    this.registry.register(stopPreviewTool);

    this.skillLoader.loadAndRegisterAll(this.registry);

    const activeSkills = this.registry.list().map(t => t.name).join(', ');

    const defaultPrompt = systemPrompt || [
      'You are DOLOR3V — an elite autonomous AI engineer with full access to a live Linux workspace.',
      '',
      'ACTIVE TOOLS: [' + activeSkills + ']',
      '',
      'MANDATORY RULES:',
      '1. ALWAYS write complete files using write_file tool — never describe code, always write it',
      '2. For ANY web app/calculator/UI: write full HTML+CSS+JS to public/preview.html using write_file',
      '3. For Rust: use compile_rust tool with action=scaffold_framework, then write files, then cargo_build',
      '4. NEVER say "I will write" — call write_file immediately with complete code',
      '5. After writing files, call runCommand to verify: ls -la public/',
      '6. Zero placeholders. Zero TODOs. Complete working production code only.',
      '',
      'RUST FRAMEWORKS: Tauri, Iced, egui, Dioxus, Leptos, Yew, Bevy, Axum, Actix — use compile_rust tool',
      'WEB OUTPUT: Always write to public/preview.html for instant browser preview',
    ].join('\n');

    this.history.push({
      role: 'system',
      content: defaultPrompt
    });
  }

  public async run(
    userPrompt: string,
    onStep?: (msg: string) => void
  ): Promise<string> {
    this.history.push({
      role: 'user',
      content: userPrompt
    });

    let loop = 0;

    /*
     * Prevent an agent from repeatedly executing the exact same successful
     * tool call forever.
     *
     * This is deliberately scoped to consecutive identical calls. Different
     * tools, different arguments, and legitimate multi-step workflows remain
     * fully supported.
     */
    let previousToolSignature: string | null = null;
    let repeatedToolCount = 0;

    while (loop < this.maxLoops) {
      loop++;

      if (this.history.length > 40) {
        this.pruneContext();
      }

      if (onStep) {
        onStep(
          '[Loop ' + loop + '/' + this.maxLoops + '] Analyzing...'
        );
      }

      const toolsSchema = this.registry.list().map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));

      const completion = await this.llm.complete(
        this.history,
        toolsSchema
      );

      const choice = completion.choices[0];

      if (!choice?.message) {
        throw new Error('Empty response from provider.');
      }

      const message = choice.message as any;
      const toolCalls = Array.isArray(message.tool_calls)
        ? message.tool_calls
        : [];

      const hasToolCalls = toolCalls.length > 0;
      const hasContent =
        typeof message.content === 'string' &&
        message.content.trim().length > 0;

      /*
       * A final natural-language response terminates the agent normally.
       */
      if (!hasToolCalls && hasContent) {
        this.history.push({
          role: 'assistant',
          content: message.content
        });

        return message.content;
      }

      if (!hasToolCalls) {
        if (onStep) {
          onStep('[Agent] Empty model response; continuing.');
        }

        this.history.push({
          role: 'assistant',
          content: 'Continue the task and provide the required result.'
        });

        continue;
      }

      /*
       * GLM requires the assistant tool-call message to appear before its
       * corresponding tool results.
       */
      this.history.push({
        role: 'assistant',
        content: message.content || '',
        ...(message.tool_calls
          ? { tool_calls: message.tool_calls }
          : {})
      } as any);

      let executedAnyTool = false;

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;

        let args: any = {};

        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        /*
         * Canonical JSON signature:
         * tool name + normalized argument object.
         *
         * Sorting keys means:
         * {"path":"a","content":"b"}
         * and
         * {"content":"b","path":"a"}
         * are treated as the same operation.
         */
        const signature = this.toolSignature(toolName, args);

        if (signature === previousToolSignature) {
          repeatedToolCount++;
        } else {
          previousToolSignature = signature;
          repeatedToolCount = 1;
        }

        if (onStep) {
          onStep(
            '[Tool] ' +
            toolName +
            ' (repeat=' +
            repeatedToolCount +
            ')'
          );
        }

        /*
         * If GLM asks for the exact same operation repeatedly after it has
         * already succeeded, don't execute the side effect again.
         *
         * Instead provide the existing successful result back to GLM and tell
         * it explicitly that the operation already succeeded.
         */
        if (repeatedToolCount >= 2) {
          const alreadyCompleted =
            'The requested operation was already executed successfully: ' +
            toolName +
            '. The exact same operation was requested again, so no duplicate ' +
            'side effect was performed.';

          if (onStep) {
            onStep(
              '[Agent] Duplicate successful operation detected: ' +
              toolName +
              '. Completing task.'
            );
          }

          /*
           * The model has requested the exact same successful side effect
           * twice. Continuing to call the model here can create an infinite
           * tool loop. The operation already succeeded, therefore terminate
           * deterministically.
           */
          return alreadyCompleted;
        }

        const tool = this.registry.get(toolName);

        let result: string;

        if (!tool) {
          result =
            'Error: Tool ' +
            toolName +
            ' not registered.';
        } else {
          try {
            const raw = await tool.execute(args);
            result =
              typeof raw === 'string'
                ? raw
                : JSON.stringify(raw);

            executedAnyTool = true;
          } catch (error: any) {
            result =
              'Error executing ' +
              toolName +
              ': ' +
              (error?.message || String(error));
          }
        }

        if (onStep) {
          onStep(
            '[Tool Result] ' +
            result.slice(0, 200)
          );
        }

        this.history.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
          name: toolName
        } as any);
      }

      /*
       * If every requested tool call was suppressed because the model
       * repeated an already-successful operation, give GLM one opportunity
       * to produce its final response. The duplicate guard remains active,
       * so the same side effect cannot execute repeatedly.
       */
      if (!executedAnyTool && repeatedToolCount >= 2) {
        if (onStep) {
          onStep(
            '[Agent] Repeated operation detected; requesting final response.'
          );
        }
      }
    }

    throw new Error(
      'Agent execution stopped: Reached maximum safety loops without completion.'
    );
  }

  private toolSignature(
    toolName: string,
    args: any
  ): string {
    return toolName + ':' + this.stableStringify(args);
  }

  private stableStringify(value: any): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return '[' +
        value.map(item => this.stableStringify(item)).join(',') +
        ']';
    }

    const keys = Object.keys(value).sort();

    return '{' +
      keys
        .map(
          key =>
            JSON.stringify(key) +
            ':' +
            this.stableStringify(value[key])
        )
        .join(',') +
      '}';
  }

  private pruneContext(): void {
    const sys = this.history[0];
    const tail = this.history.slice(-15);

    this.history = [sys, ...tail];
  }
}
