import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

const WORKSPACE_DIR = path.resolve(
  process.cwd(),
  'app_workspace',
);

function commandExists(command: string): boolean {
  try {
    const result = require('child_process').execFileSync(
      'bash',
      ['-lc', `command -v ${command}`],
      { stdio: 'ignore' },
    );
    return Boolean(result);
  } catch {
    return false;
  }
}

function findVercelCLI(): string {
  if (commandExists('vercel')) {
    return 'vercel';
  }

  const npmPrefix = process.env.npm_config_prefix;

  if (npmPrefix) {
    const candidate = path.join(
      npmPrefix,
      'bin',
      'vercel',
    );

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Vercel CLI is not installed or is not available in PATH.',
  );
}

function validateWorkspace(): void {
  if (!fs.existsSync(WORKSPACE_DIR)) {
    throw new Error(
      `Workspace does not exist: ${WORKSPACE_DIR}`,
    );
  }

  const entries = fs.readdirSync(WORKSPACE_DIR);

  if (entries.length === 0) {
    throw new Error(
      'Cannot deploy an empty app_workspace.',
    );
  }

  const htmlCandidates = [
    path.join(WORKSPACE_DIR, 'index.html'),
    path.join(WORKSPACE_DIR, 'public', 'index.html'),
    path.join(WORKSPACE_DIR, 'public', 'preview.html'),
  ];

  const htmlEntry = htmlCandidates.find((file) =>
    fs.existsSync(file),
  );

  if (!htmlEntry) {
    throw new Error(
      'No deployable HTML entry found in app_workspace.',
    );
  }
}

function extractDeploymentUrl(output: string): string {
  const matches = output.match(
    /https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g,
  );

  if (!matches || matches.length === 0) {
    throw new Error(
      `Vercel deployment completed but no deployment URL was returned.\n${output}`,
    );
  }

  const vercelUrl = matches.find((url) =>
    /vercel\.app/i.test(url),
  );

  return (vercelUrl || matches[matches.length - 1]).replace(
    /[),.]+$/,
    '',
  );
}

export async function deployToVercel(): Promise<string> {
  if (!process.env.VERCEL_TOKEN) {
    throw new Error(
      'VERCEL_TOKEN is not set.',
    );
  }

  validateWorkspace();

  const vercel = findVercelCLI();

  const { stdout, stderr } = await execFileAsync(
    vercel,
    [
      'deploy',
      WORKSPACE_DIR,
      '--yes',
      '--token',
      process.env.VERCEL_TOKEN,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VERCEL_TOKEN: process.env.VERCEL_TOKEN,
      },
      timeout: 900_000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const combined = `${stdout}\n${stderr}`.trim();

  return extractDeploymentUrl(combined);
}

// Backward-compatible export for the existing Studio route.
export async function deployToSurge(): Promise<string> {
  return deployToVercel();
}
