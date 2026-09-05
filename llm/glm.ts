import OpenAI from 'openai';
import { config } from '../config/schema';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

interface LLMProvider {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
}

function getProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  const cerebrasKey = (process.env.CEREBRAS_API_KEY || '').trim();
  if (cerebrasKey.length > 5) {
    providers.push({
      name: 'Cerebras',
      apiKey: cerebrasKey,
      baseURL: 'https://api.cerebras.ai/v1',
      model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
      maxTokens: 8192,
    });
  }

  const groqKey = (process.env.TOKENROUTER_API_KEY || config.glmApiKey || '').trim();
  if (groqKey.length > 5) {
    providers.push({
      name: 'Groq',
      apiKey: groqKey,
      baseURL: process.env.TOKENROUTER_BASE_URL || config.glmBaseUrl,
      model: (process.env.TOKENROUTER_MODEL || config.glmModel).trim(),
      maxTokens: config.maxTokens,
    });
  }

  if (providers.length === 0) throw new Error('No LLM provider configured — set CEREBRAS_API_KEY or TOKENROUTER_API_KEY');
  return providers;
}

export class GLMLLMClient {
  public async complete(
    messages: ChatMessage[],
    toolsSchema?: any[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const providers = getProviders();

    for (const provider of providers) {
      const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL, timeout: 120_000, maxRetries: 0 });
      const payload: any = {
        model: provider.model,
        messages,
        max_tokens: provider.maxTokens,
        temperature: 0.1,
      };
      if (toolsSchema?.length) { payload.tools = toolsSchema; payload.tool_choice = 'auto'; }

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.error(`[DAV AGENT] ${provider.name} attempt=${attempt} model=${provider.model}`);
          const res = await client.chat.completions.create(payload);
          const msg = res.choices?.[0]?.message as any;
          if (msg && !msg.tool_calls?.length && !msg.content?.trim() && msg.reasoning_content) msg.content = msg.reasoning_content;
          if (msg && msg.content == null) msg.content = '';
          console.error(`[DAV AGENT] ${provider.name} ✅ done`);
          return res;
        } catch (err: any) {
          const status = err?.status || '???';
          const body = String(err?.message || err).slice(0, 200);
          const transient = [408, 409, 429, 500, 502, 503, 504].includes(status);
          console.error(`[DAV AGENT] ${provider.name} attempt=${attempt} status=${status} err=${body}`);
          if (!transient || attempt >= 3) break; // try next provider
          await new Promise(r => setTimeout(r, attempt === 1 ? 2000 : 5000));
        }
      }
      console.error(`[DAV AGENT] ${provider.name} failed — trying next provider...`);
    }

    throw new Error('DAV Agent: all LLM providers failed');
  }
}
