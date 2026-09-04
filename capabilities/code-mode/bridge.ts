import { ToolRegistry } from '../../tools/registry';
import { CodeModeConfig } from './types';
import { CodeModeError } from './errors';
import { CodeModeCatalog } from './catalog';
import { CodeModeTelemetryStore } from './telemetry';

function jsonSafe(value: unknown): unknown {
  if (value === undefined) return null;

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(jsonSafe);
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(
      value as Record<string, unknown>
    )) {
      output[key] = jsonSafe(item);
    }

    return output;
  }

  return String(value);
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(jsonSafe(value)));
}

export class CodeModeBridge {
  private activeCalls = 0;

  constructor(
    private readonly registry: ToolRegistry,
    public readonly catalog: CodeModeCatalog,
    private readonly config: CodeModeConfig,
    private readonly telemetry: CodeModeTelemetryStore
  ) {}

  async call(
    callableName: string,
    input: unknown
  ): Promise<unknown> {
    if (this.activeCalls >= this.config.maxPendingToolCalls) {
      throw new CodeModeError(
        'invalid_input',
        `Maximum pending tool calls exceeded: ${this.config.maxPendingToolCalls}`
      );
    }

    const handle = this.catalog.get(callableName);

    if (!handle) {
      throw new CodeModeError(
        'invalid_input',
        `Unknown Code Mode tool: ${callableName}`
      );
    }

    const tool = this.registry.get(handle.toolName);

    if (!tool) {
      throw new CodeModeError(
        'internal_error',
        `Registered tool disappeared: ${handle.toolName}`
      );
    }

    this.activeCalls++;
    this.telemetry.called();

    try {
      const result = await tool.execute(
        jsonSafe(input) as Record<string, unknown>
      );

      if (byteLength(result) > this.config.maxOutputBytes) {
        throw new CodeModeError(
          'output_limit_exceeded',
          `Tool output exceeded ${this.config.maxOutputBytes} bytes`
        );
      }

      return jsonSafe(result);
    } finally {
      this.activeCalls--;
    }
  }
}
