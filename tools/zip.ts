import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

const ROOT_DIR = path.resolve(process.cwd());
const APP_WORKSPACE = path.join(ROOT_DIR, 'app_workspace');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const EXCLUDED_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test',
  '.git',
  '.github',
  '.vercel',
  'node_modules',
  'target',
  'dist',
  'coverage',
  '.cache',
  '.turbo',
  '.next',
  '.DS_Store',
  'workspace-export.zip',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.log',
]);

function shouldExclude(name: string): boolean {
  if (EXCLUDED_NAMES.has(name)) {
    return true;
  }

  if (name.startsWith('.env.')) {
    return true;
  }

  return EXCLUDED_EXTENSIONS.has(
    path.extname(name).toLowerCase(),
  );
}

function addDirectory(
  directory: string,
  zipDirectory: JSZip,
): void {
  if (!fs.existsSync(directory)) {
    return;
  }

  const entries = fs.readdirSync(
    directory,
    { withFileTypes: true },
  );

  for (const entry of entries) {
    if (shouldExclude(entry.name)) {
      continue;
    }

    const absolutePath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      const child = zipDirectory.folder(entry.name);

      if (!child) {
        throw new Error(
          `Unable to create ZIP directory: ${entry.name}`,
        );
      }

      addDirectory(absolutePath, child);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    zipDirectory.file(
      entry.name,
      fs.readFileSync(absolutePath),
    );
  }
}

function validateWorkspace(): void {
  if (!fs.existsSync(APP_WORKSPACE)) {
    throw new Error(
      `Application workspace does not exist: ${APP_WORKSPACE}`,
    );
  }

  const entries = fs.readdirSync(
    APP_WORKSPACE,
    { withFileTypes: true },
  );

  if (entries.length === 0) {
    throw new Error(
      'Application workspace is empty.',
    );
  }

  const hasEntryPoint =
    fs.existsSync(
      path.join(APP_WORKSPACE, 'index.html'),
    ) ||
    fs.existsSync(
      path.join(APP_WORKSPACE, 'public', 'index.html'),
    ) ||
    fs.existsSync(
      path.join(APP_WORKSPACE, 'public', 'preview.html'),
    );

  if (!hasEntryPoint) {
    throw new Error(
      'Application workspace has no deployable HTML entry point.',
    );
  }
}

function validateZip(zip: JSZip): void {
  const entries = Object.keys(zip.files);

  if (entries.length === 0) {
    throw new Error(
      'Generated application export is empty.',
    );
  }

  const forbidden = entries.filter(entry => {
    const normalized = entry.replace(/\\/g, '/');
    const basename = path.posix.basename(normalized);

    return (
      basename === '.env' ||
      basename.startsWith('.env.') ||
      normalized.includes('/.git/') ||
      normalized.includes('/node_modules/') ||
      normalized.includes('/target/') ||
      normalized.includes('/dist/') ||
      normalized.includes('/.vercel/') ||
      normalized === '.git' ||
      normalized === '.vercel'
    );
  });

  if (forbidden.length > 0) {
    throw new Error(
      `Export security validation failed: ${forbidden.join(', ')}`,
    );
  }
}

export async function createWorkspaceZip(): Promise<string> {
  validateWorkspace();

  fs.mkdirSync(
    PUBLIC_DIR,
    { recursive: true },
  );

  const outputPath = path.join(
    PUBLIC_DIR,
    'workspace-export.zip',
  );

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const zip = new JSZip();

  addDirectory(
    APP_WORKSPACE,
    zip,
  );

  validateZip(zip);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  });

  if (!buffer || buffer.length === 0) {
    throw new Error(
      'Generated application export is empty.',
    );
  }

  fs.writeFileSync(
    outputPath,
    buffer,
  );

  return outputPath;
}
