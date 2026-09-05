import OpenAI from 'openai';
import { config } from '../config/schema';
export interface ChatMessage { role: 'system'|'user'|'assistant'|'tool'; content: string; name?: string; tool_call_id?: string; tool_calls?: any[]; }
export class GLMLLMClient {
  private getClient(): OpenAI {
    const apiKey = (process.env.TOKENROUTER_API_KEY || config.glmApiKey || '').trim();
    const baseURL = process.env.TOKENROUTER_BASE_URL || config.glmBaseUrl;
    if (!apiKey || apiKey.length < 5) throw new Error('TOKENROUTER_API_KEY not set');
    return new OpenAI({ apiKey, baseURL, timeout: 120_000, maxRetries: 0 });
  }
  public async complete(messages: ChatMessage[], toolsSchema?: any[]): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const client = this.getClient();
    const model = (process.env.TOKENROUTER_MODEL || config.glmModel).trim();
    const payload: any = { model, messages, max_tokens: config.maxTokens, temperature: 0.1 };
    if (toolsSchema?.length) { payload.tools = toolsSchema; payload.tool_choice = 'auto'; }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await client.chat.completions.create(payload);
        const msg = res.choices?.[0]?.message as any;
        if (msg && !msg.tool_calls?.length && !msg.content?.trim() && msg.reasoning_content) msg.content = msg.reasoning_content;
        if (msg && msg.content == null) msg.content = '';
        return res;
      } catch (err: any) {
        const status = err?.status || '???';
        const transient = [408,409,429,500,502,503,504].includes(status);
        console.error(`[DAV AGENT] attempt=${attempt} status=${status} err=${String(err?.message||err).slice(0,200)}`);
        if (!transient || attempt >= 3) throw new Error(`DAV Agent LLM [${status}]: ${err?.message}`);
        await new Promise(r => setTimeout(r, attempt === 1 ? 2000 : 5000));
      }
    }
    throw new Error('DAV Agent: exhausted retries');
  }
}
