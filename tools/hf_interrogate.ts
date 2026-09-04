import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './registry';

const execAsync = promisify(exec);

export const hfDatasetTool: Tool = {
  name: 'hf_dataset_interrogate',
  description: 'Inspect and map data flows inside Hugging Face dataset repositories.',
  parameters: {
    type: 'object',
    properties: {
      repoUrl: { type: 'string', description: 'Hugging Face dataset Git URL' },
    },
    required: ['repoUrl'],
  },
  execute: async ({ repoUrl }) => {
    try {
      const cloneDir = '/tmp/hf_dataset_inspect';
      const cmd = `rm -rf ${cloneDir} && git clone ${repoUrl} ${cloneDir} && ls -la ${cloneDir}`;
      const { stdout } = await execAsync(cmd);
      return JSON.stringify({ result: stdout.trim(), path: cloneDir });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
};
