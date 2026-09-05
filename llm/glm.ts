import OpenAI from 'openai';
import { config } from '../config/schema';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

function errorDetails(err: any): string {
  const details: string[] = [];

  if (err?.name) details.push(`name=${String(err.name)}`);
  if (err?.code) details.push(`code=${String(err.code)}`);
  if (err?.errno) details.push(`errno=${String(err.errno)}`);
  if (err?.syscall) details.push(`syscall=${String(err.syscall)}`);
  if (err?.address) details.push(`address=${String(err.address)}`);
  if (err?.port) details.push(`port=${String(err.port)}`);
  if (err?.type) details.push(`type=${String(err.type)}`);

  if (err?.cause) {
    if (err.cause.name) details.push(`cause_name=${String(err.cause.name)}`);
    if (err.cause.code) details.push(`cause_code=${String(err.cause.code)}`);
    if (err.cause.errno) details.push(`cause_errno=${String(err.cause.errno)}`);
    if (err.cause.syscall) details.push(`cause_syscall=${String(err.cause.syscall)}`);
    if (err.cause.message) details.push(`cause=${String(err.cause.message)}`);
  }

  return details.join(' ');
}

export class GLMLLMClient {
  private getClient(): OpenAI {
    const rawApiKey = process.env.TOKENROUTER_API_KEY || config.glmApiKey;
    const apiKey = rawApiKey?.trim();
    const baseURL = (process.env.TOKENROUTER_BASE_URL || config.glmBaseUrl).trim();

    if (!apiKey || apiKey.length < 5) {
      throw new Error('TOKENROUTER_API_KEY environment variable is not configured.');
    }

    if (/[\\r\\n]/.test(apiKey)) {
      throw new Error('TOKENROUTER_API_KEY contains an invalid newline character.');
    }

    if (/[^\\x20-\\x7E]/.test(apiKey)) {
      throw new Error('TOKENROUTER_API_KEY contains invalid control characters.');
    }

    return new OpenAI({
      apiKey,
      baseURL,
      timeout: 120_000,
      maxRetries: 0,
    });
  }

  public async complete(
    messages: ChatMessage[],
    toolsSchema?: any[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const client = this.getClient();
    const baseURL = process.env.TOKENROUTER_BASE_URL || config.glmBaseUrl;
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
          `messages=${messages.length} ` +
          `tools=${toolsSchema?.length || 0} ` +
          `model=${model} ` +
          `baseURL=${baseURL}`
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
          err?.status ??
          err?.statusCode ??
          err?.response?.status ??
          err?.cause?.status ??
          '???';

        const body =
          err?.error?.message ??
          err?.response?.data?.error?.message ??
          err?.response?.data?.message ??
          err?.message ??
          String(err);

        const details = errorDetails(err);

        console.error(
          `[GLM] attempt=${attempt}/${maxAttempts} ` +
          `status=${status} ` +
          `model=${model} ` +
          `body=${String(body).slice(0, 500)} ` +
          `${details}`
        );

        if (err?.cause) {
          console.error(
            `[GLM] underlying cause: ${JSON.stringify(
              {
                name: err.cause?.name,
                message: err.cause?.message,
                code: err.cause?.code,
                errno: err.cause?.errno,
                syscall: err.cause?.syscall,
                address: err.cause?.address,
                port: err.cause?.port,
              },
              null,
              2
            )}`
          );
        }

        const transient =
          status === 408 ||
          status === 409 ||
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        if (!transient || attempt >= maxAttempts) {
          throw new Error(
            `GLM Failure [${status}] (${model}): ${String(body)}${details ? ` | ${details}` : ''}`
          );
        }

        const delay = retryDelays[attempt - 1] || 5_000;

        console.error(
          `[GLM] transient upstream failure; retrying in ${delay / 1000}s...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `GLM Failure: exhausted retry attempts (${model})`
    );
  }
}
