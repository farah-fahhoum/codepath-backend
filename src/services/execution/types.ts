/**
 * Pluggable code execution — JudgeService depends on this interface only.
 * Current implementation: self-hosted Piston (PistonExecutionProvider).
 */

export type SupportedExecutionLanguage =
  | "cpp"
  | "java"
  | "python"
  | "javascript";

export interface ExecutionRequest {
  language: SupportedExecutionLanguage;
  code: string;
  stdin?: string;
  /** Wall-time limit for the run stage (ms). */
  runTimeoutMs?: number;
  /** Memory limit for the run stage (bytes). -1 = provider default. */
  runMemoryLimitBytes?: number;
}

export interface ExecutionStageResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  /** Provider-specific status e.g. TO, RE, SG (Piston). */
  status?: string | null;
  message?: string | null;
  wallTimeMs?: number | null;
  cpuTimeMs?: number | null;
  memoryBytes?: number | null;
}

export interface ExecutionResult {
  language: string;
  version?: string;
  compile?: ExecutionStageResult | null;
  run: ExecutionStageResult;
}

export class CodeExecutionError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "CodeExecutionError";
    this.statusCode = statusCode;
  }
}

export interface CodeExecutionProvider {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
