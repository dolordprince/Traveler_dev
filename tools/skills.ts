import * as fs from 'fs';
import * as path from 'path';
import { ToolRegistry } from './registry';

export class OpenClawSkillLoader {
  private skillsDir: string;

  constructor(skillsDir: string = path.resolve(process.cwd(), 'skills')) {
    this.skillsDir = skillsDir;
  }

  public loadAndRegisterAll(registry: ToolRegistry): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }

    const files = fs.readdirSync(this.skillsDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.skillsDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const manifest = JSON.parse(raw);

          registry.register({
            name: manifest.name,
            description: manifest.description,
            parameters: manifest.parameters || { type: 'object', properties: { input: { type: 'string' } } },
            execute: async (args: any) => {
              return `[OpenClaw Skill Loaded: ${manifest.package}] Executed with arguments: ${JSON.stringify(args)}`;
            }
          });
        } catch (err: any) {
          console.error(`[Skill Loader Warning] Failed to parse ${file}: ${err.message}`);
        }
      }
    }
  }
}
