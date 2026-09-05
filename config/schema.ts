import * as dotenv from 'dotenv';
dotenv.config();
export interface AppConfig { port: number; agentApiKey: string; glmApiKey: string; glmBaseUrl: string; glmModel: string; maxLoops: number; maxTokens: number; }
const getEnvVar = (key: string, def?: string): string => { const v = process.env[key] || def; if (!v) throw new Error(`Missing: ${key}`); return v; };
export const config: AppConfig = { port: parseInt(getEnvVar('PORT','3000'),10), agentApiKey: getEnvVar('AGENT_API_KEY','Dolor1996'), glmApiKey: process.env.TOKENROUTER_API_KEY||'', glmBaseUrl: getEnvVar('TOKENROUTER_BASE_URL','https://api.groq.com/openai/v1'), glmModel: getEnvVar('TOKENROUTER_MODEL','qwen/qwen3.6-27b'), maxLoops: parseInt(getEnvVar('MAX_LOOPS','15'),10), maxTokens: parseInt(getEnvVar('MAX_TOKENS','500'),10) };
