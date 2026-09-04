import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

const WORKSPACE = path.resolve(process.cwd(), 'app_workspace');
const CARGO = process.env.CARGO_BIN || 'cargo';
const RUSTC = process.env.RUSTC_BIN || 'rustc';

const ENV = {
  ...process.env,
  PATH: `${process.env.HOME || '/root'}/.cargo/bin:${process.env.PATH || ''}`,
  CARGO_TERM_COLOR: 'never',
};

function resolveWorkspacePath(relativePath: string): string {
  const root = path.resolve(WORKSPACE);
  const target = path.resolve(root, relativePath);

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Path escapes app_workspace');
  }

  return target;
}

function projectPath(projectName: string): string {
  if (!projectName) {
    throw new Error('project_name is required');
  }

  const dir = resolveWorkspacePath(projectName);

  if (!fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    throw new Error(`Cargo project not found: ${projectName}`);
  }

  return dir;
}

async function command(
  executable: string,
  args: string[],
  cwd: string,
  timeout = 120000,
): Promise<string> {
  try {
    const result = await execFileAsync(executable, args, {
      cwd,
      env: ENV,
      timeout,
      maxBuffer: 20 * 1024 * 1024,
    });

    return [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();
  } catch (error: any) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';

    throw new Error(
      [stdout, stderr, error.message]
        .filter(Boolean)
        .join('\n')
        .trim(),
    );
  }
}

function validateProjectName(name: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(
      'project_name may contain only letters, numbers, underscores and hyphens',
    );
  }
}

export const rustTool = {
  name: 'compile_rust',

  description:
    'Production Rust/Cargo tool. Uses the already installed Rust toolchain. Does not install Rust, global Cargo tools, or frameworks automatically. Supports checking the toolchain, creating Cargo projects, building, running, testing, checking, formatting, and adding explicitly requested dependencies.',

  parameters: {
    type: 'object',

    properties: {
      action: {
        type: 'string',
        enum: [
          'toolchain',
          'cargo_new',
          'cargo_build',
          'cargo_check',
          'cargo_run',
          'cargo_test',
          'cargo_fmt',
          'add_dependency',
          'run_file',
        ],
      },

      file_path: {
        type: 'string',
        description: 'Relative path to a Rust source file.',
      },

      project_name: {
        type: 'string',
        description: 'Cargo project directory inside app_workspace.',
      },

      dependency: {
        type: 'string',
        description:
          'Explicit Cargo dependency specification, passed as individual cargo-add arguments only when requested.',
      },
    },

    required: ['action'],
  },

  execute: async (args: any): Promise<string> => {
    const action = args?.action;

    if (!action) {
      return 'Rust Error: action is required';
    }

    try {
      switch (action) {
        case 'toolchain': {
          const rustc = await command(RUSTC, ['--version'], WORKSPACE);
          const cargo = await command(CARGO, ['--version'], WORKSPACE);

          let targets = '';

          try {
            targets = await command(
              'rustup',
              ['target', 'list', '--installed'],
              WORKSPACE,
            );
          } catch {
            targets = 'rustup unavailable';
          }

          return [
            '=== RUST TOOLCHAIN ===',
            rustc,
            cargo,
            '',
            '=== INSTALLED TARGETS ===',
            targets,
            '',
            'No Rust packages were installed.',
          ].join('\n');
        }

        case 'cargo_new': {
          const name = args.project_name || 'rust_app';

          validateProjectName(name);

          const destination = resolveWorkspacePath(name);

          if (fs.existsSync(destination)) {
            throw new Error(`Project already exists: ${name}`);
          }

          const result = await command(
            CARGO,
            ['new', name],
            WORKSPACE,
          );

          return result || `Created Cargo project: ${name}`;
        }

        case 'cargo_build': {
          const dir = projectPath(args.project_name);

          return await command(
            CARGO,
            ['build'],
            dir,
            300000,
          );
        }

        case 'cargo_check': {
          const dir = projectPath(args.project_name);

          return await command(
            CARGO,
            ['check'],
            dir,
            300000,
          );
        }

        case 'cargo_run': {
          const dir = projectPath(args.project_name);

          return await command(
            CARGO,
            ['run'],
            dir,
            300000,
          );
        }

        case 'cargo_test': {
          const dir = projectPath(args.project_name);

          return await command(
            CARGO,
            ['test'],
            dir,
            300000,
          );
        }

        case 'cargo_fmt': {
          const dir = projectPath(args.project_name);

          return await command(
            CARGO,
            ['fmt', '--all'],
            dir,
            120000,
          );
        }

        case 'add_dependency': {
          const dir = projectPath(args.project_name);

          if (!args.dependency) {
            throw new Error('dependency is required');
          }

          /*
           * Do not pass the dependency as a shell command.
           * This avoids shell injection and prevents accidental
           * execution of arbitrary commands.
           *
           * Example:
           * dependency = "serde"
           */
          const dependency = String(args.dependency).trim();

          if (
            !/^[A-Za-z0-9_.-]+(?:@[A-Za-z0-9_.-]+)?$/.test(dependency)
          ) {
            throw new Error(
              'Invalid dependency. Use a crate name such as "serde" or "tokio".',
            );
          }

          return await command(
            CARGO,
            ['add', dependency],
            dir,
            300000,
          );
        }

        case 'run_file': {
          if (!args.file_path) {
            throw new Error('file_path is required');
          }

          const source = resolveWorkspacePath(args.file_path);

          if (!fs.existsSync(source)) {
            throw new Error(`Rust source file not found: ${args.file_path}`);
          }

          if (!source.endsWith('.rs')) {
            throw new Error('file_path must point to a .rs file');
          }

          const output = source.slice(0, -3);

          await command(
            RUSTC,
            [source, '-o', output],
            WORKSPACE,
            300000,
          );

          return await command(
            output,
            [],
            path.dirname(output),
            120000,
          );
        }

        default:
          throw new Error(`Unsupported Rust action: ${action}`);
      }
    } catch (error: any) {
      return `Rust Error:\n${error.message || String(error)}`;
    }
  },
};
