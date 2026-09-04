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

app.use(express.json({
  limit: '50mb',
  strict: true,
  verify: (_req, _res, buf) => {
    if (buf.length > 50 * 1024 * 1024) {
      throw new Error('Request body exceeds 50MB limit.');
    }
  },
}));

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body must contain valid JSON.',
    });
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body exceeds the 50MB limit.',
    });
  }

  next(err);
});
app.use(express.static(APP_WORKSPACE));
app.use(express.static(PUBLIC_DIR));

const SKIP = new Set([
  'node_modules',
  '.git',
  '.env',
  'dist',
  'coverage',
  '.cache',
  '.turbo',
  '.next',
  '.vercel',
]);

function getFileTree(dir: string): any[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => !SKIP.has(entry.name))
    .map(entry => {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT_DIR, full);

      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: rel,
          type: 'dir',
          children: getFileTree(full),
        };
      }

      return {
        name: entry.name,
        path: rel,
        type: 'file',
      };
    });
}

function resolveWorkspacePath(input: string): string {
  const requested = String(input || '').trim();

  if (!requested) {
    throw new Error('File path is required.');
  }

  const resolved = path.resolve(ROOT_DIR, requested);
  const relative = path.relative(ROOT_DIR, resolved);

  if (
    relative.startsWith('..' + path.sep) ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Access denied.');
  }

  return resolved;
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'traveler-dev-backend',
    workspace: fs.existsSync(APP_WORKSPACE),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'traveler-dev-backend',
    workspace: fs.existsSync(APP_WORKSPACE),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/files', (_req, res) => {
  try {
    res.json(getFileTree(ROOT_DIR));
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get('/api/file-content', (req, res) => {
  try {
    const filePath = resolveWorkspacePath(String(req.query.path || ''));

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found.');
    }

    if (!fs.statSync(filePath).isFile()) {
      return res.status(400).send('Requested path is not a file.');
    }

    return res.send(fs.readFileSync(filePath, 'utf8'));
  } catch (error: any) {
    return res.status(403).send(error.message);
  }
});

app.post('/api/agent/stream', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string'
    ? req.body.prompt.trim()
    : '';

  if (!prompt) {
    return res.status(400).json({
      error: 'Prompt is required.',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type: string, data: string) => {
    if (res.writableEnded) return;

    res.write(
      `data: ${JSON.stringify({
        type,
        data,
      })}\n\n`,
    );
  };

  try {
    send('status', 'Initializing TRAVELER DEV Agent...');

    const agent = new AgentOrchestrator();

    send(
      'status',
      'Running prompt through the production tool pipeline...',
    );

    const output = await agent.run(
      prompt,
      (message: string) => send('status', message),
    );

    send('output', output);
    send('status', 'Complete.');

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    send('error', error?.message || 'Agent execution failed.');

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

app.post('/api/deploy', async (_req, res) => {
  try {
    const url = await deployToVercel();

    return res.json({
      success: true,
      provider: 'vercel',
      url,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Deployment failed.',
    });
  }
});

app.get('/api/download', async (_req, res) => {
  try {
    const zipPath = await createWorkspaceZip();

    const stat = fs.statSync(zipPath);

    res.setHeader(
      'Content-Type',
      'application/zip',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="traveler-dev-app.zip"',
    );

    res.setHeader(
      'Content-Length',
      stat.size,
    );

    return res.sendFile(zipPath);
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Workspace export failed.',
    });
  }
});

app.get('/api/zip', (_req, res) => {
  res.redirect('/api/download');
});

const PORT = Number.parseInt(
  process.env.PORT || '3000',
  10,
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[TRAVELER DEV Backend] http://0.0.0.0:${PORT}`,
  );
  console.log(`[ROOT] ${ROOT_DIR}`);
});
