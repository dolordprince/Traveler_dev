import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'app_workspace');

export const readFileTool = {
  name: 'read_file',
  description: 'Reads a file from the user app workspace.',
  parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  execute: async (args: { path: string }) => {
    try {
      const safePath = path.join(WORKSPACE_DIR, args.path.replace(/^(\.\.[\/\\])+/, ''));
      return fs.readFileSync(safePath, 'utf8');
    } catch (e: any) { return `Error: ${e.message}`; }
  }
};

export const writeFileTool = {
  name: 'write_file',
  description: 'Writes a file to the user app workspace.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
  execute: async (args: { path: string, content: string }) => {
    try {
      const safePath = path.join(WORKSPACE_DIR, args.path.replace(/^(\.\.[\/\\])+/, ''));
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, args.content, 'utf8');
      return `Successfully wrote to ${args.path}`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
};
