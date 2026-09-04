import express, { Request, Response } from 'express';
import { config } from '../config/schema';
import { authenticateApiKey } from './auth';
import { AgentOrchestrator } from '../core/agent';

const app = express();
app.use(express.json());

app.post('/v1/agent/run', authenticateApiKey, async (req: Request, res: Response): Promise<void> => {
  const { prompt, systemPrompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Invalid Payload', message: 'String field "prompt" is required.' });
    return;
  }

  try {
    const agent = new AgentOrchestrator(systemPrompt);
    const output = await agent.run(prompt);
    res.status(200).json({ status: 'success', output });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`[Gateway] Agent Gateway running on port ${config.port}`);
  console.log(`[Gateway] Token Auth Key: ${config.agentApiKey}`);
  console.log('[Gateway] Model Provider: GLM (' + (process.env.GROQ_MODEL || config.glmModel) + ')');
});
