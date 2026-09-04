import OpenAI from 'openai';
import { config } from '../config/schema';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export class GLMLLMClient {
  private getClient(): OpenAI {
    const apiKey = process.env.TOKENROUTER_API_KEY || config.glmApiKey;
    const baseURL = process.env.TOKENROUTER_BASE_URL || config.glmBaseUrl;

    if (!apiKey || apiKey.length < 5) {
      throw new Error('TOKENROUTER_API_KEY environment variable is not configured.');
    }

    return new OpenAI({
      apiKey,
      baseURL,

      // GLM-5.3 reasoning responses can legitimately take tens of seconds.
      // Keep the request bounded, but allow enough time for a real completion.
      timeout: 120_000,

      // We implement explicit retries below so the retry policy is visible
      // and limited to transient upstream failures.
      maxRetries: 0,
    });
  }

  public async complete(
    messages: ChatMessage[],
    toolsSchema?: any[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const client = this.getClient();
    const model = process.env.TOKENROUTER_MODEL || config.glmModel;

    const payload: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model,
      messages: messages as any,
      max_tokens: 8192,
      temperature: 0.1,
    };

    if (toolsSchema && toolsSchema.length > 0) {
      payload.tools = toolsSchema;
      payload.tool_choice = 'auto';
    }

    const maxAttempts = 3;
    const retryDelays = [2_000, 5_000];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const started = Date.now();

        console.error(
          `[GLM] request start attempt=${attempt}/${maxAttempts} ` +
          `messages=${messages.length} tools=${toolsSchema?.length || 0} ` +
          `model=${model}`
        );

        const response = await client.chat.completions.create(payload);

        const elapsed = ((Date.now() - started) / 1000).toFixed(2);

        const debugChoice = response.choices?.[0];
        const debugMsg = debugChoice?.message as any;

        console.error(
          `[GLM] request complete ${elapsed}s ` +
          `finish=${debugChoice?.finish_reason || 'none'} ` +
          `tool_calls=${debugMsg?.tool_calls?.length || 0} ` +
          `content=${debugMsg?.content ? String(debugMsg.content).length : 0} ` +
          `reasoning=${debugMsg?.reasoning_content ? String(debugMsg.reasoning_content).length : 0}`
        );

        const choice = response.choices?.[0];

        if (choice?.message) {
          const msg = choice.message as any;

          /*
           * GLM-5.3 may return reasoning_content while content is null/empty.
           *
           * For tool calls, preserve the tool-call structure and only use
           * reasoning_content as fallback content when there is no tool call.
           * This prevents reasoning text from being treated as normal assistant
           * output when GLM has actually requested a tool.
           */
          const hasToolCalls =
            Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;

          if (
            !hasToolCalls &&
            (!msg.content || String(msg.content).trim() === '') &&
            msg.reasoning_content
          ) {
            msg.content = msg.reasoning_content;
          }

          if (msg.content == null) {
            msg.content = '';
          }
        }

        return response;
      } catch (err: any) {
        const status =
          err?.status ||
          err?.statusCode ||
          err?.response?.status ||
          '???';

        const body =
          err?.error?.message ||
          err?.response?.data?.error?.message ||
          err?.message ||
          String(err);

        const transient =
          status === 408 ||
          status === 409 ||
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        console.error(
          `[GLM] attempt=${attempt}/${maxAttempts} status=${status} ` +
          `model=${model} body=${String(body).slice(0, 300)}`
        );

        if (!transient || attempt >= maxAttempts) {
          throw new Error(
            `GLM Failure [${status}] (${model}): ${String(body)}`
          );
        }

        const delay = retryDelays[attempt - 1] || 5_000;

        console.error(
          `[GLM] transient upstream failure; retrying in ${delay / 1000}s...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`GLM Failure: exhausted retry attempts (${model})`);
  }
}
