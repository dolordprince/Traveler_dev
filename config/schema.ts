import * as dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  agentApiKey: string;
  glmApiKey: string;
  glmBaseUrl: string;
  glmModel: string;
  maxLoops: number;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export const config: AppConfig = {
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  agentApiKey: getEnvVar('AGENT_API_KEY', 'Dolor1996'),
  glmApiKey: process.env.TOKENROUTER_API_KEY || '',
  glmBaseUrl: getEnvVar('TOKENROUTER_BASE_URL', 'https://api.tokenrouter.com/v1'),
  glmModel: getEnvVar('TOKENROUTER_MODEL', 'z-ai/glm-5.3-free'),
  maxLoops: parseInt(getEnvVar('MAX_LOOPS', '15'), 10),
};
