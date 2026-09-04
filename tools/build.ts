import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const WORKSPACE_DIR = path.resolve(
  process.cwd(),
  'app_workspace'
);

let BUILD_ROOT = WORKSPACE_DIR;

const BUILD_TIMEOUT_MS = Number.parseInt(
  process.env.BUILD_TIMEOUT_MS || '900000',
  10
);

interface CommandResult {
  command: string;
  args: string[];
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

interface BuildResult {
  success: boolean;
  framework: string;
  project: string;
  command: string;
  exitCode: number;
  durationMs: number;
  artifacts: string[];
  stdout: string;
  stderr: string;
  error?: string;
}

function exists(file: string): boolean {
  return fs.existsSync(
    path.join(BUILD_ROOT, file)
  );
}

function readJson(file: string): any | null {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(BUILD_ROOT, file),
        'utf8'
      )
    );
  } catch {
    return null;
  }
}

function readText(file: string): string {
  try {
    return fs.readFileSync(
      path.join(BUILD_ROOT, file),
      'utf8'
    );
  } catch {
    return '';
  }
}

function run(
  command: string,
  args: string[],
  cwd: string
): Promise<CommandResult> {
  return new Promise(resolve => {
    const started = Date.now();

    const child = spawn(
      command,
      args,
      {
        cwd,
        env: {
          ...process.env
        },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let stdout = '';
    let stderr = '';
    let finished = false;

    const finish = (code: number) => {
      if (finished) return;

      finished = true;

      resolve({
        command,
        args,
        code,
        stdout,
        stderr,
        durationMs:
          Date.now() - started
      });
    };

    child.stdout.on(
      'data',
      data => {
        stdout += data.toString();
      }
    );

    child.stderr.on(
      'data',
      data => {
        stderr += data.toString();
      }
    );

    child.on(
      'error',
      error => {
        stderr += error.message;
        finish(127);
      }
    );

    child.on(
      'close',
      code => {
        finish(code ?? 1);
      }
    );

    const timer = setTimeout(() => {
      stderr +=
        `\nBuild terminated after ${BUILD_TIMEOUT_MS}ms.\n`;

      child.kill('SIGTERM');

      setTimeout(() => {
        if (!finished) {
          child.kill('SIGKILL');
          finish(124);
        }
      }, 5000);
    }, BUILD_TIMEOUT_MS);

    child.on('close', () => {
      clearTimeout(timer);
    });
  });
}

function commandExists(
  command: string
): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn(
      'sh',
      ['-lc', `command -v ${command}`],
      {
        stdio: 'ignore'
      }
    );

    child.on(
      'close',
      code => resolve(code === 0)
    );

    child.on(
      'error',
      () => resolve(false)
    );
  });
}

function cargoPackage(): any {
  const cargo = readText(
    'Cargo.toml'
  );

  const packageMatch =
    cargo.match(
      /\[package\]([\s\S]*?)(?:\n\[|$)/
    );

  if (!packageMatch) {
    return {};
  }

  const section =
    packageMatch[1];

  const nameMatch =
    section.match(
      /^\s*name\s*=\s*"([^"]+)"/m
    );

  return {
    name: nameMatch?.[1] || 'rust-project'
  };
}

function detectFramework(): string {
  const cargo = readText(
    'Cargo.toml'
  );

  const lower =
    cargo.toLowerCase();

  if (
    exists('Dioxus.toml') ||
    /(?:^|\n)\s*dioxus\s*=/.test(lower) ||
    /(?:^|\n)\s*dioxus-[a-z0-9_-]+\s*=/.test(lower)
  ) {
    return 'dioxus';
  }

  if (
    exists('Cargo.leptos') ||
    /(?:^|\n)\s*leptos\s*=/.test(lower) ||
    /(?:^|\n)\s*leptos-[a-z0-9_-]+\s*=/.test(lower)
  ) {
    return 'leptos';
  }

  if (
    exists('Trunk.toml') &&
    (
      lower.includes('yew') ||
      lower.includes('yew =')
    )
  ) {
    return 'yew';
  }

  if (
    /(?:^|\n)\s*bevy\s*=/.test(lower) ||
    /(?:^|\n)\s*bevy-[a-z0-9_-]+\s*=/.test(lower)
  ) {
    return 'bevy';
  }

  if (
    exists('Cargo.toml')
  ) {
    return 'rust';
  }

  const packageJson =
    readJson('package.json');

  if (packageJson) {
    return 'node';
  }

  if (
    exists('index.html') ||
    exists('public/index.html') ||
    exists('public/preview.html')
  ) {
    return 'static';
  }

  return 'unknown';
}

function detectWasmProject(
  framework: string
): boolean {
  if (
    framework === 'yew' ||
    framework === 'leptos'
  ) {
    return true;
  }

  if (
    exists('Trunk.toml')
  ) {
    return true;
  }

  const cargo =
    readText('Cargo.toml')
      .toLowerCase();

  return (
    cargo.includes(
      'wasm-bindgen'
    ) ||
    cargo.includes(
      'wasm-bindgen-futures'
    ) ||
    cargo.includes(
      'web-sys'
    ) ||
    cargo.includes(
      'js-sys'
    )
  );
}

function artifactCandidates(
  framework: string
): string[] {
  const candidates: string[] = [];

  const dirs = [
    'dist',
    'target/release',
    'target/debug',
    'target/wasm32-unknown-unknown/release',
    'target/wasm32-unknown-unknown/debug',
    'target/wasm32-wasip1/release',
    'target/wasm32-wasip2/release'
  ];

  if (framework === 'static') {
    const staticCandidates = [
      'index.html',
      'public/index.html',
      'public/preview.html'
    ];

    for (const file of staticCandidates) {
      if (exists(file)) {
        candidates.push(file);
      }
    }
  }

  for (const dir of dirs) {
    const absolute =
      path.join(
        BUILD_ROOT,
        dir
      );

    if (!fs.existsSync(absolute)) {
      continue;
    }

    walkArtifacts(
      absolute,
      BUILD_ROOT,
      candidates
    );
  }

  return candidates.filter(
    file => {
      const lower =
        file.toLowerCase();

      const basename =
        path.basename(lower);

      if (
        basename.startsWith('.')
      ) {
        return false;
      }

      if (
        lower.includes('node_modules/') ||
        lower.includes('/.fingerprint/') ||
        lower.includes('/deps/') ||
        lower.includes('/incremental/') ||
        lower.includes('/build/')
      ) {
        return false;
      }

      if (
        lower.endsWith('.wasm') ||
        lower.endsWith('.html') ||
        lower.endsWith('.js') ||
        lower.endsWith('.css') ||
        lower.endsWith('.map') ||
        lower.endsWith('.exe') ||
        lower.endsWith('.dll') ||
        lower.endsWith('.so') ||
        lower.endsWith('.dylib')
      ) {
        return true;
      }

      return (
        framework === 'bevy' ||
        framework === 'rust'
      ) && (
        !path.extname(lower) ||
        lower.endsWith('.bin')
      );
    }
  );
}

function walkArtifacts(
  directory: string,
  root: string,
  output: string[]
): void {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(
      directory,
      {
        withFileTypes: true
      }
    );
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(
      directory,
      entry.name
    );

    const relative = path.relative(
      root,
      absolute
    );

    const normalized = relative
      .split(path.sep)
      .join('/')
      .toLowerCase();

    if (
      normalized
        .split('/')
        .some(segment =>
          segment === '.fingerprint' ||
          segment === 'deps' ||
          segment === 'incremental' ||
          segment === 'build'
        )
    ) {
      continue;
    }

    let isDirectory = false;
    let isFile = false;

    try {
      const stat = fs.statSync(absolute);

      isDirectory = stat.isDirectory();
      isFile = stat.isFile();
    } catch {
      continue;
    }

    if (isDirectory) {
      walkArtifacts(
        absolute,
        root,
        output
      );
      continue;
    }

    if (isFile) {
      output.push(
        relative
          .split(path.sep)
          .join('/')
      );
    }
  }
}

async function buildDioxus(): Promise<CommandResult> {
  const hasDx =
    await commandExists('dx');

  if (!hasDx) {
    return {
      command: 'dx',
      args: ['build', '--release'],
      code: 127,
      stdout: '',
      stderr:
        'Dioxus CLI (`dx`) is not installed. Install it with `cargo install dioxus-cli` and rerun the build.',
      durationMs: 0
    };
  }

  return run(
    'dx',
    [
      'build',
      '--release'
    ],
    BUILD_ROOT
  );
}

async function buildLeptos(): Promise<CommandResult> {
  const hasCargoLeptos =
    await commandExists(
      'cargo-leptos'
    );

  if (!hasCargoLeptos) {
    return {
      command: 'cargo',
      args: [
        'leptos',
        'build',
        '--release'
      ],
      code: 127,
      stdout: '',
      stderr:
        'cargo-leptos is not installed. Install it with `cargo install cargo-leptos` and rerun the build.',
      durationMs: 0
    };
  }

  return run(
    'cargo',
    [
      'leptos',
      'build',
      '--release'
    ],
    BUILD_ROOT
  );
}

async function buildYew(): Promise<CommandResult> {
  const hasTrunk =
    await commandExists(
      'trunk'
    );

  if (!hasTrunk) {
    return {
      command: 'trunk',
      args: [
        'build',
        '--release'
      ],
      code: 127,
      stdout: '',
      stderr:
        'Trunk is not installed. Install it with `cargo install trunk` and rerun the build.',
      durationMs: 0
    };
  }

  return run(
    'trunk',
    [
      'build',
      '--release'
    ],
    BUILD_ROOT
  );
}

async function buildBevy(): Promise<CommandResult> {
  const wasm =
    detectWasmProject(
      'bevy'
    );

  if (wasm) {
    const hasTrunk =
      await commandExists(
        'trunk'
      );

    if (
      exists('Trunk.toml') &&
      hasTrunk
    ) {
      return run(
        'trunk',
        [
          'build',
          '--release'
        ],
        BUILD_ROOT
      );
    }

    return run(
      'cargo',
      [
        'build',
        '--release',
        '--target',
        'wasm32-unknown-unknown'
      ],
      BUILD_ROOT
    );
  }

  return run(
    'cargo',
    [
      'build',
      '--release'
    ],
    BUILD_ROOT
  );
}

async function buildRust(
  framework: string
): Promise<CommandResult> {
  const wasm =
    detectWasmProject(
      framework
    );

  if (wasm) {
    return run(
      'cargo',
      [
        'build',
        '--release',
        '--target',
        'wasm32-unknown-unknown'
      ],
      BUILD_ROOT
    );
  }

  return run(
    'cargo',
    [
      'build',
      '--release'
    ],
    BUILD_ROOT
  );
}

async function buildNode(): Promise<CommandResult> {
  const packageJson =
    readJson(
      'package.json'
    );

  const scripts =
    packageJson?.scripts || {};

  if (
    typeof scripts.build !==
    'string'
  ) {
    return {
      command: 'npm',
      args: [
        'run',
        'build'
      ],
      code: 1,
      stdout: '',
      stderr:
        'package.json does not define a build script.',
      durationMs: 0
    };
  }

  return run(
    'npm',
    [
      'run',
      'build'
    ],
    BUILD_ROOT
  );
}

async function buildStatic(): Promise<CommandResult> {
  const candidates = [
    'index.html',
    'public/index.html',
    'public/preview.html'
  ];

  const entry = candidates.find(
    file => exists(file)
  );

  if (!entry) {
    return {
      command: 'static',
      args: [],
      code: 1,
      stdout: '',
      stderr:
        'Static project detected but no HTML entry point was found.',
      durationMs: 0
    };
  }

  let html: string;

  try {
    html = fs.readFileSync(
      path.join(BUILD_ROOT, entry),
      'utf8'
    );
  } catch (error: any) {
    return {
      command: 'static',
      args: [],
      code: 1,
      stdout: '',
      stderr:
        `Unable to read static entry point ${entry}: ${error.message}`,
      durationMs: 0
    };
  }

  if (!/<html(?:\s|>)/i.test(html)) {
    return {
      command: 'static',
      args: [],
      code: 1,
      stdout: '',
      stderr:
        `Static entry point ${entry} is not valid HTML.`,
      durationMs: 0
    };
  }

  if (!/<body(?:\s|>)/i.test(html)) {
    return {
      command: 'static',
      args: [],
      code: 1,
      stdout: '',
      stderr:
        `Static entry point ${entry} does not contain a body element.`,
      durationMs: 0
    };
  }

  return {
    command: 'static',
    args: [],
    code: 0,
    stdout:
      `Static project validated successfully: ${entry}`,
    stderr: '',
    durationMs: 0
  };
}

export async function buildProject(_projectPath?: string): Promise<BuildResult> {
  const started = Date.now();

  BUILD_ROOT = _projectPath
    ? path.resolve(process.cwd(), _projectPath)
    : WORKSPACE_DIR;

  if (!fs.existsSync(BUILD_ROOT)) {
    return {
      success: false,
      framework: 'unknown',
      project: path.basename(BUILD_ROOT),
      command: '',
      exitCode: 1,
      durationMs: Date.now() - started,
      artifacts: [],
      stdout: '',
      stderr: '',
      error: `Project directory does not exist: ${BUILD_ROOT}`
    };
  }

  const framework =
    detectFramework();

  const cargo = cargoPackage();
  const packageJson = readJson('package.json');

  const project =
    cargo?.name ||
    packageJson?.name ||
    path.basename(BUILD_ROOT);

  let result: CommandResult;

  switch (framework) {
    case 'dioxus':
      result =
        await buildDioxus();
      break;

    case 'leptos':
      result =
        await buildLeptos();
      break;

    case 'yew':
      result =
        await buildYew();
      break;

    case 'bevy':
      result =
        await buildBevy();
      break;

    case 'rust':
      result =
        await buildRust(
          framework
        );
      break;

    case 'node':
      result =
        await buildNode();
      break;

    case 'static':
      result =
        await buildStatic();
      break;

    default:
      return {
        success: false,
        framework,
        project,
        command: '',
        exitCode: 1,
        durationMs:
          Date.now() - started,
        artifacts: [],
        stdout: '',
        stderr: '',
        error:
          'Unable to identify a supported project type in app_workspace.'
      };
  }

  const artifacts =
    result.code === 0
      ? artifactCandidates(
          framework
        )
      : [];

  return {
    success:
      result.code === 0,
    framework,
    project,
    command:
      [result.command, ...result.args]
        .join(' '),
    exitCode:
      result.code,
    durationMs:
      result.durationMs,
    artifacts,
    stdout:
      result.stdout,
    stderr:
      result.stderr,
    ...(result.code !== 0
      ? {
          error:
            result.stderr ||
            `Build failed with exit code ${result.code}.`
        }
      : {})
  };
}

export const buildTool = {
  name: 'build_project',

  description:
    'Build the actual application in app_workspace. Detects and performs real Dioxus, Leptos, Yew, Bevy, Rust, Node, or static builds. Never reports success when the underlying build command fails.',

  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },

  execute: async () => {
    const result =
      await buildProject();

    return JSON.stringify(
      result,
      null,
      2
    );
  }
};
