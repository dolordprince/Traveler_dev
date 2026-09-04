import * as fs from 'fs';
import * as path from 'path';

const MEMORY_FILE = path.join(process.cwd(), 'data_memory', 'hf_project_memory.json');

interface MemoryEntry { id: string; prompt: string; files_modified: string[]; timestamp: string; }

export class VectorMemory {
  private memories: MemoryEntry[] = [];

  constructor() {
    if (fs.existsSync(MEMORY_FILE)) {
      this.memories = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    }
  }

  public saveProjectContext(prompt: string, files: string[]) {
    this.memories.push({ id: Date.now().toString(), prompt, files_modified: files, timestamp: new Date().toISOString() });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memories, null, 2));
  }

  public queryPastProjects(query: string): string {
    const terms = query.toLowerCase().split(' ');
    // Basic TF-IDF heuristic for zero-dependency local vectoring
    const scored = this.memories.map(m => {
      let score = 0;
      terms.forEach(t => { if (m.prompt.toLowerCase().includes(t)) score++; });
      return { ...m, score };
    }).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    
    if (scored.length === 0) return "No relevant past project context found in dataset.";
    return "Relevant past projects:\n" + scored.map(m => `[${m.timestamp}] User asked: "${m.prompt}". Files altered: ${m.files_modified.join(', ')}`).join('\n');
  }
}
