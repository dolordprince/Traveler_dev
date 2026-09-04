export type CodeModeErrorCode =
  | 'invalid_input'
  | 'runtime_unavailable'
  | 'aborted'
  | 'timeout'
  | 'output_limit_exceeded'
  | 'snapshot_limit_exceeded'
  | 'internal_error';

export class CodeModeError extends Error {
  public readonly code: CodeModeErrorCode;

  constructor(code: CodeModeErrorCode, message: string) {
    super(message);
    this.name = 'CodeModeError';
    this.code = code;
  }
}
