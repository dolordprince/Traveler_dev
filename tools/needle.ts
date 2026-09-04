import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ednaSpeak } from './elevenlabs';

const execAsync = promisify(exec);
const ROOT = process.cwd();
const APP_WS = path.join(ROOT, 'app_workspace');

interface Fault {
  severity: 'critical' | 'warning' | 'info';
  location: string;
  issue: string;
  suggestion: string;
}

async function scanWorkspace(): Promise<Fault[]> {
  const faults: Fault[] = [];

  // 1. Check .env keys
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    if (!env.includes('TOKENROUTER_API_KEY') || env.includes('your_tokenrouter')) {
      faults.push({ severity: 'critical', location: '.env', issue: 'TOKENROUTER_API_KEY missing or placeholder', suggestion: 'Set real API key' });
    }
    if (!env.includes('ELEVENLABS_API_KEY') || env.match(/ELEVENLABS_API_KEY=\s*$/m)) {
      faults.push({ severity: 'warning', location: '.env', issue: 'ELEVENLABS_API_KEY not set', suggestion: 'Add ElevenLabs key for Edna voice' });
    }
  } else {
    faults.push({ severity: 'critical', location: '.env', issue: '.env file missing', suggestion: 'Create .env with required keys' });
  }

  // 2. Check TypeScript build
  try {
    await execAsync('npm run build 2>&1', { cwd: ROOT, timeout: 30000 });
  } catch (e: any) {
    const errors = (e.stdout || e.message || '').match(/error TS\d+[^\n]*/g) || [];
    errors.slice(0, 5).forEach((err: string) => {
      faults.push({ severity: 'critical', location: 'TypeScript', issue: err.trim(), suggestion: 'Fix TypeScript compilation error' });
    });
  }

  // 3. Check studio server responding
  try {
    const { stdout } = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null');
    if (stdout.trim() !== '200') {
      faults.push({ severity: 'critical', location: 'Studio Server', issue: 'Server not responding on port 3000 (got ' + stdout.trim() + ')', suggestion: 'Run: node dist/gateway/studio.js' });
    }
  } catch (_) {
    faults.push({ severity: 'critical', location: 'Studio Server', issue: 'Studio server not running', suggestion: 'Run: node dist/gateway/studio.js &' });
  }

  // 4. Check app_workspace
  if (!fs.existsSync(APP_WS)) {
    faults.push({ severity: 'warning', location: 'app_workspace', issue: 'app_workspace directory missing', suggestion: 'Run: mkdir -p app_workspace/public' });
  } else {
    const previewHtml = path.join(APP_WS, 'public', 'preview.html');
    if (!fs.existsSync(previewHtml)) {
      faults.push({ severity: 'info', location: 'app_workspace/public', issue: 'No preview.html — workspace is empty', suggestion: 'Prompt agent to build something' });
    }
  }

  // 5. Check dist compiled
  if (!fs.existsSync(path.join(ROOT, 'dist', 'gateway', 'studio.js'))) {
    faults.push({ severity: 'critical', location: 'dist/', issue: 'Compiled dist missing', suggestion: 'Run: npm run build' });
  }

  // 6. Check node_modules
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    faults.push({ severity: 'critical', location: 'node_modules', issue: 'Dependencies not installed', suggestion: 'Run: npm install' });
  }

  // 7. Check Rust/Cargo
  try {
    await execAsync('cargo --version 2>/dev/null');
  } catch (_) {
    faults.push({ severity: 'warning', location: 'Rust', issue: 'Cargo not found in PATH', suggestion: 'source ~/.cargo/env or install Rust' });
  }

  return faults;
}

function formatReport(faults: Fault[]): string {
  if (faults.length === 0) return 'All systems healthy. No faults detected.';
  const critical = faults.filter(f => f.severity === 'critical');
  const warnings = faults.filter(f => f.severity === 'warning');
  const info = faults.filter(f => f.severity === 'info');
  let report = '';
  if (critical.length) report += critical.length + ' critical fault' + (critical.length > 1 ? 's' : '') + ': ' + critical.map(f => f.issue).join('; ') + '. ';
  if (warnings.length) report += warnings.length + ' warning' + (warnings.length > 1 ? 's' : '') + ': ' + warnings.map(f => f.issue).join('; ') + '. ';
  if (info.length) report += info.length + ' info: ' + info.map(f => f.issue).join('; ') + '.';
  return report.trim();
}

export const needleScanTool = {
  name: 'needle_scan_workspace',
  description: 'Needle scans the entire DOLOR3V workspace for faults — TypeScript errors, missing env keys, server health, missing files. Returns a full fault report. Edna will speak the summary.',
  parameters: {
    type: 'object',
    properties: {
      speak_result: { type: 'boolean', description: 'Whether Edna should speak the report aloud', default: true }
    },
    required: []
  },
  execute: async (args: { speak_result?: boolean }): Promise<string> => {
    try {
      const faults = await scanWorkspace();
      const report = formatReport(faults);
      const speakResult = args.speak_result !== false;

      const fullReport = {
        scanned_at: new Date().toISOString(),
        total_faults: faults.length,
        critical: faults.filter(f => f.severity === 'critical').length,
        warnings: faults.filter(f => f.severity === 'warning').length,
        info: faults.filter(f => f.severity === 'info').length,
        faults: faults,
        summary: report
      };

      if (speakResult) {
        const intro = faults.length === 0
          ? 'Edna here. Workspace scan complete. Everything looks healthy.'
          : 'Edna here. Scan complete. ' + report;
        await ednaSpeak(intro).catch(() => {});
      }

      return JSON.stringify(fullReport, null, 2);
    } catch (e: any) {
      return 'Needle scan error: ' + e.message;
    }
  }
};

export const needleBuildTool = {
  name: 'needle_build_and_report',
  description: 'Needle tells the agent to build a website or app, waits for completion, then has Edna speak the result report back to the user.',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'What to build (e.g. "a landing page for a bakery")' }
    },
    required: ['task']
  },
  execute: async (args: { task: string }): Promise<string> => {
    await ednaSpeak('Starting build task: ' + args.task.slice(0, 100) + '. Please wait.').catch(() => {});
    return 'NEEDLE_BUILD_TASK:' + args.task + '\nEdna will report when complete. The agent should now build the requested item and call edna_speak with the completion report.';
  }
};
