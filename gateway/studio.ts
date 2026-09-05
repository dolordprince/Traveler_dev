import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AgentOrchestrator } from '../core/agent';
import { deployToVercel } from '../tools/deploy';
import { createWorkspaceZip } from '../tools/zip';

const app = express();
const ROOT_DIR = path.resolve(process.cwd());
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const APP_WORKSPACE = path.join(ROOT_DIR, 'app_workspace');
const BRAND = 'DAV TEAM AGENT';
const VERSION = '2.0.0';

let daemonTick = 0;
let daemonLastBeat = new Date().toISOString();

function startDaemon() {
  console.log(`[${BRAND}] 🔵 Daemon started`);
  const loop = setInterval(() => {
    daemonTick++;
    daemonLastBeat = new Date().toISOString();
    if (daemonTick % 60 === 0) console.log(`[${BRAND}] 💓 tick=${daemonTick} beat=${daemonLastBeat}`);
  }, 1000);
  loop.unref();
}

app.use(express.json({ limit: '50mb' }));

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Invalid JSON' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload Too Large' });
  next(err);
});

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.use(express.static(APP_WORKSPACE));
app.use(express.static(PUBLIC_DIR));

const SKIP = new Set(['node_modules','.git','.env','dist','coverage','.cache','.turbo','.next','.vercel']);
function getFileTree(dir: string): any[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !SKIP.has(e.name))
    .map(e => {
      const full = path.join(dir, e.name);
      const rel = path.relative(ROOT_DIR, full);
      if (e.isDirectory()) return { name: e.name, path: rel, type: 'dir', children: getFileTree(full) };
      return { name: e.name, path: rel, type: 'file' };
    });
}

function resolveWorkspacePath(input: string): string {
  const requested = String(input || '').trim();
  if (!requested) throw new Error('File path is required.');
  const resolved = path.resolve(ROOT_DIR, requested);
  const relative = path.relative(ROOT_DIR, resolved);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('Access denied.');
  return resolved;
}

app.get('/', (_req, res) => res.json({ agent: BRAND, version: VERSION, author: 'Dolor David Prince', status: 'online', daemon: { tick: daemonTick, lastBeat: daemonLastBeat }, endpoints: ['GET /health','GET /api/health','GET /api/status','GET /api/files','GET /api/file-content?path=','POST /api/agent/stream','POST /api/deploy','GET /api/download'] }));

app.get('/health', (_req, res) => res.json({ status: 'ok', agent: BRAND, version: VERSION, workspace: fs.existsSync(APP_WORKSPACE), daemon: { tick: daemonTick, lastBeat: daemonLastBeat }, timestamp: new Date().toISOString() }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', agent: BRAND, version: VERSION, workspace: fs.existsSync(APP_WORKSPACE), daemon: { tick: daemonTick, lastBeat: daemonLastBeat }, timestamp: new Date().toISOString() }));

app.get('/api/status', (_req, res) => res.json({ agent: BRAND, version: VERSION, author: 'Dolor David Prince', daemon: { tick: daemonTick, lastBeat: daemonLastBeat }, workspace: fs.existsSync(APP_WORKSPACE), model: process.env.TOKENROUTER_MODEL || 'qwen/qwen3.6-27b', timestamp: new Date().toISOString() }));

app.get('/api/files', (_req, res) => { try { res.json(getFileTree(ROOT_DIR)); } catch (e: any) { res.status(500).json({ error: e.message }); } });

app.get('/api/file-content', (req, res) => {
  try {
    const filePath = resolveWorkspacePath(String(req.query.path || ''));
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found.');
    if (!fs.statSync(filePath).isFile()) return res.status(400).send('Not a file.');
    return res.send(fs.readFileSync(filePath, 'utf8'));
  } catch (e: any) { return res.status(403).send(e.message); }
});

app.post('/api/agent/stream', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type: string, data: string) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify({ type, data, agent: BRAND })}\n\n`);
  };

  const t0 = Date.now();
  try {
    send('init', `${BRAND} v${VERSION} — online`);
    send('init', 'Author: Dolor David Prince');
    send('status', 'Booting agent loop...');
    const agent = new AgentOrchestrator();
    send('status', 'Agent initialized — entering production tool pipeline...');
    const output = await agent.run(prompt, (msg: string) => send('status', msg));
    send('output', output);
    send('done', `Completed in ${((Date.now()-t0)/1000).toFixed(2)}s | ${BRAND}`);
    if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
  } catch (error: any) {
    send('error', error?.message || 'Agent execution failed.');
    send('done', `Failed after ${((Date.now()-t0)/1000).toFixed(2)}s | ${BRAND}`);
    if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
  }
});

app.post('/api/deploy', async (_req, res) => {
  try { const url = await deployToVercel(); return res.json({ success: true, provider: 'vercel', url, agent: BRAND }); }
  catch (e: any) { return res.status(500).json({ success: false, error: e?.message, agent: BRAND }); }
});

app.get('/api/download', async (_req, res) => {
  try {
    const zipPath = await createWorkspaceZip();
    const stat = fs.statSync(zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="davteam-workspace.zip"');
    res.setHeader('Content-Length', stat.size);
    return res.sendFile(zipPath);
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

app.get('/api/zip', (_req, res) => res.redirect('/api/download'));

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║       ${BRAND} v${VERSION}         ║`);
  console.log(`║     by Dolor David Prince                ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`[BOOT] http://0.0.0.0:${PORT}`);
  console.log(`[ROOT] ${ROOT_DIR}`);
  console.log(`[MODEL] ${process.env.TOKENROUTER_MODEL || 'qwen/qwen3.6-27b'}`);
  startDaemon();
});
