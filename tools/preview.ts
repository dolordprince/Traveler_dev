import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {
  spawn,
  ChildProcess,
} from 'node:child_process';

type PreviewResult = {
  success: boolean;
  url?: string;
  port?: number;
  command?: string;
  pid?: number;
  error?: string;
};

const running =
  new Map<number, ChildProcess>();

async function exists(
  file: string,
): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function findPort(
  start = 4173,
): Promise<number> {
  return new Promise(resolve => {
    let port = start;

    const check = () => {
      const server =
        http.createServer();

      server.once(
        'error',
        () => {
          port++;
          check();
        },
      );

      server.once(
        'listening',
        () => {
          server.close(
            () => resolve(port),
          );
        },
      );

      server.listen(
        port,
        '127.0.0.1',
      );
    };

    check();
  });
}

function httpCheck(
  port: number,
): Promise<boolean> {
  return new Promise(resolve => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/',
        timeout: 2000,
      },
      response => {
        response.resume();

        resolve(
          !!response.statusCode &&
          response.statusCode >= 200 &&
          response.statusCode < 500,
        );
      },
    );

    request.on(
      'error',
      () => resolve(false),
    );

    request.on(
      'timeout',
      () => {
        request.destroy();
        resolve(false);
      },
    );
  });
}

async function waitForHttp(
  port: number,
  timeoutMs = 30000,
): Promise<boolean> {
  const start = Date.now();

  while (
    Date.now() - start <
    timeoutMs
  ) {
    if (await httpCheck(port)) {
      return true;
    }

    await new Promise(
      resolve =>
        setTimeout(resolve, 500),
    );
  }

  return false;
}

async function chooseCommand(
  root: string,
  port: number,
): Promise<{
  command: string;
  args: string[];
}> {
  const packageFile =
    path.join(
      root,
      'package.json',
    );

  if (
    await exists(packageFile)
  ) {
    const pkg = JSON.parse(
      await fs.readFile(
        packageFile,
        'utf8',
      ),
    );

    const scripts =
      pkg.scripts ?? {};

    if (scripts.preview) {
      return {
        command: 'npm',
        args: [
          'run',
          'preview',
          '--',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
        ],
      };
    }

    if (scripts.dev) {
      return {
        command: 'npm',
        args: [
          'run',
          'dev',
          '--',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
        ],
      };
    }

    if (
      await exists(
        path.join(root, 'dist'),
      )
    ) {
      return {
        command: 'npx',
        args: [
          'vite',
          'preview',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
        ],
      };
    }
  }

  if (
    await exists(
      path.join(root, 'dist'),
    )
  ) {
    return {
      command: 'npx',
      args: [
        'http-server',
        'dist',
        '-a',
        '127.0.0.1',
        '-p',
        String(port),
      ],
    };
  }

  return {
    command: 'npx',
    args: [
      'http-server',
      '.',
      '-a',
      '127.0.0.1',
      '-p',
      String(port),
    ],
  };
}

export async function startPreview(
  root: string,
): Promise<PreviewResult> {
  const absoluteRoot =
    path.resolve(root);

  if (
    !(await exists(absoluteRoot))
  ) {
    return {
      success: false,
      error:
        `Project does not exist: ${absoluteRoot}`,
    };
  }

  const port =
    await findPort();

  const build =
    await chooseCommand(
      absoluteRoot,
      port,
    );

  const command =
    `${build.command} ${build.args.join(' ')}`;

  console.log(
    `[PREVIEW] ${command}`,
  );

  const child = spawn(
    build.command,
    build.args,
    {
      cwd: absoluteRoot,
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );

  running.set(
    port,
    child,
  );

  child.stdout?.on(
    'data',
    data =>
      process.stdout.write(
        `[PREVIEW] ${data}`,
      ),
  );

  child.stderr?.on(
    'data',
    data =>
      process.stderr.write(
        `[PREVIEW] ${data}`,
      ),
  );

  const healthy =
    await waitForHttp(port);

  if (!healthy) {
    running.delete(port);

    try {
      child.kill(
        'SIGTERM',
      );
    } catch {}

    return {
      success: false,
      command,
      error:
        'Preview process failed HTTP health check.',
    };
  }

  return {
    success: true,
    url:
      `http://127.0.0.1:${port}/`,
    port,
    command,
    pid: child.pid,
  };
}

export function stopPreview(
  port: number,
): boolean {
  const child =
    running.get(port);

  if (!child) {
    return false;
  }

  running.delete(port);

  try {
    child.kill(
      'SIGTERM',
    );
  } catch {}

  return true;
}
