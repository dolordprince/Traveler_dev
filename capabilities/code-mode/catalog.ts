import { ToolRegistry, ToolDefinition } from '../../tools/registry';
import { createCallableNames } from './names';
import { CodeModeConfig, ToolHandle } from './types';
import { CodeModeTelemetryStore } from './telemetry';

const CONTROL_TOOLS = new Set([
  'exec',
  'wait',
  'tool_search',
  'tool_search_code'
]);

function searchableText(tool: ToolDefinition): string {
  return [
    tool.name,
    tool.description,
    JSON.stringify(tool.parameters || {})
  ]
    .join(' ')
    .toLowerCase();
}

export class CodeModeCatalog {
  private readonly handles = new Map<string, ToolHandle>();
  private readonly byToolName = new Map<string, ToolHandle>();

  constructor(
    private readonly registry: ToolRegistry,
    private readonly config: CodeModeConfig,
    private readonly telemetry: CodeModeTelemetryStore
  ) {
    this.rebuild();
  }

  rebuild(): void {
    this.handles.clear();
    this.byToolName.clear();

    const tools = this.registry
      .list()
      .filter(tool => !CONTROL_TOOLS.has(tool.name))
      .filter(tool => !(tool as any).codeModeHidden);

    const names = createCallableNames(tools.map(tool => tool.name));

    for (const tool of tools) {
      const callableName = names.get(tool.name)!;

      const handle: ToolHandle = {
        callableName,
        toolName: tool.name,
        label: (tool as any).label || tool.name,
        description: tool.description,
        source: 'agent',
        input: tool.parameters,
        output: (tool as any).outputSchema,
        describe: () => {
          this.telemetry.described();

          return {
            name: callableName,
            callableName,
            toolName: tool.name,
            label: (tool as any).label || tool.name,
            description: tool.description,
            source: 'agent',
            parameters: tool.parameters,
            outputSchema: (tool as any).outputSchema
          };
        }
      };

      this.handles.set(callableName, handle);
      this.byToolName.set(tool.name, handle);
    }

    this.telemetry.setCatalogSize(this.handles.size);
    this.telemetry.setSourceCount('agent', this.handles.size);
  }

  all(): ToolHandle[] {
    return Array.from(this.handles.values());
  }

  search(query: string, requestedLimit?: number): ToolHandle[] {
    this.telemetry.searched();

    const limit = Math.min(
      Math.max(
        requestedLimit || this.config.searchDefaultLimit,
        1
      ),
      this.config.maxSearchLimit
    );

    const normalized = String(query || '').trim().toLowerCase();

    if (!normalized) {
      return this.all().slice(0, limit);
    }

    const terms = normalized.split(/\s+/).filter(Boolean);

    return this.all()
      .map(handle => {
        const tool = this.registry.get(handle.toolName)!;
        const text = searchableText(tool);

        let score = 0;

        for (const term of terms) {
          if (tool.name.toLowerCase() === term) score += 100;
          if (tool.name.toLowerCase().includes(term)) score += 30;
          if (tool.description.toLowerCase().includes(term)) score += 15;
          if (text.includes(term)) score += 5;
        }

        return { handle, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.handle);
  }

  get(callableName: string): ToolHandle | undefined {
    return this.handles.get(callableName);
  }

  getByToolName(toolName: string): ToolHandle | undefined {
    return this.byToolName.get(toolName);
  }
}
