import { CodeModeConfig, CodeModeSetting } from './types';

function booleanSetting(value: string | undefined): CodeModeSetting {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'auto') return 'auto';

  return false;
}

function integerEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] || '', 10);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function getCodeModeConfig(): CodeModeConfig {
  return {
    enabled: booleanSetting(process.env.CODE_MODE_ENABLED),
    timeoutMs: integerEnv('CODE_MODE_TIMEOUT_MS', 10_000),
    memoryLimitBytes: integerEnv(
      'CODE_MODE_MEMORY_LIMIT_BYTES',
      64 * 1024 * 1024
    ),
    maxOutputBytes: integerEnv(
      'CODE_MODE_MAX_OUTPUT_BYTES',
      64 * 1024
    ),
    maxSnapshotBytes: integerEnv(
      'CODE_MODE_MAX_SNAPSHOT_BYTES',
      10 * 1024 * 1024
    ),
    maxPendingToolCalls: integerEnv(
      'CODE_MODE_MAX_PENDING_TOOL_CALLS',
      16
    ),
    snapshotTtlSeconds: integerEnv(
      'CODE_MODE_SNAPSHOT_TTL_SECONDS',
      900
    ),
    searchDefaultLimit: integerEnv(
      'CODE_MODE_SEARCH_DEFAULT_LIMIT',
      8
    ),
    maxSearchLimit: integerEnv(
      'CODE_MODE_MAX_SEARCH_LIMIT',
      50
    )
  };
}
