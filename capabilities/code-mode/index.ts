import { ToolRegistry } from '../../tools/registry';
import { getCodeModeConfig } from './config';
import { CodeModeBridge } from './bridge';
import { CodeModeCatalog } from './catalog';
import { CodeModeRuntime } from './runtime';
import { CodeModeTelemetryStore } from './telemetry';
import { CodeModeError } from './errors';
import { CodeModeExecution } from './types';

export class CodeModeController {
  public readonly config = getCodeModeConfig();
  public readonly telemetry = new CodeModeTelemetryStore();

  private readonly catalog: CodeModeCatalog;
  private readonly bridge: CodeModeBridge;
  private readonly runtime: CodeModeRuntime;

  constructor(private readonly registry: ToolRegistry) {
    this.catalog = new CodeModeCatalog(
      registry,
      this.config,
      this.telemetry
    );

    this.bridge = new CodeModeBridge(
      registry,
      this.catalog,
      this.config,
      this.telemetry
    );

    this.runtime = new CodeModeRuntime();
  }

  isEnabled(): boolean {
    return this.config.enabled === true;
  }

  isConfigured(): boolean {
    return this.config.enabled !== false;
  }

  getModelTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'exec',
          description:
            'Execute JavaScript or TypeScript inside the isolated QuickJS-WASI Code Mode runtime. The guest has no filesystem, network, subprocess, require, import, or Node.js environment. Existing agent tools are available through catalog/search and callable handles.',
          parameters: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description:
                  'JavaScript or TypeScript code to execute.'
              },
              language: {
                type: 'string',
                enum: ['javascript', 'typescript'],
                description: 'Guest language.'
              },
              restartSafe: {
                type: 'boolean',
                description:
                  'Whether the operation can safely be restarted.'
              }
            },
            required: ['code']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'wait',
          description:
            'Wait for a suspended Code Mode execution to complete.',
          parameters: {
            type: 'object',
            properties: {
              runId: {
                type: 'string'
              }
            },
            required: ['runId']
          }
        }
      }
    ];
  }

  async exec(
    code: string,
    language: 'javascript' | 'typescript' = 'javascript'
  ): Promise<CodeModeExecution> {
    if (!this.isEnabled()) {
      return {
        success: false,
        error: {
          code: 'runtime_unavailable',
          message: 'Code Mode is disabled.'
        }
      };
    }

    if (language === 'typescript') {
      const ts = await import('typescript');

      const transformed = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.None,
          strict: false
        }
      });

      code = transformed.outputText;
    }

    this.telemetry.engage();

    try {
      const result = await this.runtime.execute(
        code,
        this.bridge,
        this.config
      );

      return {
        success: true,
        value: result.value,
        output: result.output
      };
    } catch (error: any) {
      const normalized =
        error instanceof CodeModeError
          ? error
          : new CodeModeError(
              'internal_error',
              error?.message || String(error)
            );

      return {
        success: false,
        error: {
          code: normalized.code,
          message: normalized.message
        }
      };
    }
  }

  getCatalog() {
    return this.catalog;
  }

  getTelemetry() {
    return this.telemetry.snapshot();
  }
}
