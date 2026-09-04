export type CodeModeSetting = false | true | 'auto';

export interface CodeModeConfig {
  enabled: CodeModeSetting;
  timeoutMs: number;
  memoryLimitBytes: number;
  maxOutputBytes: number;
  maxSnapshotBytes: number;
  maxPendingToolCalls: number;
  snapshotTtlSeconds: number;
  searchDefaultLimit: number;
  maxSearchLimit: number;
}

export interface ToolHandleMetadata {
  callableName: string;
  toolName: string;
  label?: string;
  description: string;
  source: 'agent';
  input?: unknown;
  output?: unknown;
}

export interface ToolHandle extends ToolHandleMetadata {
  describe(): ToolHandleMetadata & {
    name: string;
    parameters: unknown;
    outputSchema?: unknown;
  };
}

export interface CodeModeExecution {
  success: boolean;
  value?: unknown;
  output?: string;
  error?: {
    code: string;
    message: string;
  };
  runId?: string;
  suspended?: boolean;
  snapshot?: string;
}

export interface CodeModeTelemetry {
  catalogSize: number;
  sourceCounts: Record<string, number>;
  searchCount: number;
  describeCount: number;
  callCount: number;
  codeModeEngaged: boolean;
  bridgeCalls: number;
  assistantTurns: number;
}
