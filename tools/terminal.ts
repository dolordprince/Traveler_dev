import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolDefinition } from './registry';

const execAsync = promisify(exec);

export const runCommandTool: ToolDefinition = {
  name: 'runCommand',
  description: 'Execute shell commands safely in workspace root.',
  parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
  execute: async ({ command }: { command: string }): Promise<string> => {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
      return stdout || stderr || 'Command executed with no output.';
    } catch (err: any) {
      return `Shell Execution Error: ${err.message}\n${err.stderr || ''}`;
    }
  }
};
