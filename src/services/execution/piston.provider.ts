import axios from "axios";
import {
  CodeExecutionError,
  CodeExecutionProvider,
  ExecutionRequest,
  ExecutionResult,
  ExecutionStageResult,
  SupportedExecutionLanguage,
} from "./types";

/** Map app language ids → Piston language names. */
const PISTON_LANGUAGE_MAP: Record<SupportedExecutionLanguage, string> = {
  cpp: "c++",
  java: "java",
  python: "python",
  javascript: "javascript",
};

interface PistonStage {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  signal?: string | null;
  status?: string | null;
  message?: string | null;
  wall_time?: number | null;
  cpu_time?: number | null;
  memory?: number | null;
}

interface PistonExecuteResponse {
  language?: string;
  version?: string;
  compile?: PistonStage;
  run?: PistonStage;
  message?: string;
}

function mapStage(stage: PistonStage | undefined): ExecutionStageResult {
  return {
    stdout: stage?.stdout ?? "",
    stderr: stage?.stderr ?? "",
    code: stage?.code ?? null,
    signal: stage?.signal ?? null,
    status: stage?.status ?? null,
    message: stage?.message ?? null,
    wallTimeMs: stage?.wall_time ?? null,
    cpuTimeMs: stage?.cpu_time ?? null,
    memoryBytes: stage?.memory ?? null,
  };
}

export class PistonExecutionProvider implements CodeExecutionProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
  }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.PISTON_BASE_URL ||
      "http://127.0.0.1:2000"
    ).replace(/\/$/, "");
    this.apiKey = options?.apiKey ?? process.env.PISTON_API_KEY ?? undefined;
    this.timeoutMs = options?.timeoutMs ?? 30000;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const pistonLanguage = PISTON_LANGUAGE_MAP[request.language];
    if (!pistonLanguage) {
      throw new CodeExecutionError(
        `Unsupported language: ${request.language}`,
        400,
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers.Authorization = this.apiKey;
    }

    const body: Record<string, unknown> = {
      language: pistonLanguage,
      version: "*",
      files: [{ content: request.code }],
      stdin: request.stdin ?? "",
    };

    if (request.runTimeoutMs != null) {
      body.run_timeout = request.runTimeoutMs;
    }
    if (request.runMemoryLimitBytes != null) {
      body.run_memory_limit = request.runMemoryLimitBytes;
    }

    try {
      const { data } = await axios.post<PistonExecuteResponse>(
        `${this.baseUrl}/api/v2/execute`,
        body,
        { headers, timeout: this.timeoutMs },
      );

      if (data?.message && !data.run && !data.compile) {
        throw new CodeExecutionError(String(data.message), 400);
      }

      if (!data?.run && !data?.compile) {
        throw new CodeExecutionError(
          "Unexpected response from code execution service",
          502,
        );
      }

      // Compile-only failure still returns compile stage; synthesize empty run if missing.
      const run = data.run
        ? mapStage(data.run)
        : {
            stdout: "",
            stderr: data.compile?.stderr ?? data.compile?.message ?? "Compile failed",
            code: data.compile?.code ?? 1,
            signal: data.compile?.signal ?? null,
            status: data.compile?.status ?? "CE",
            message: data.compile?.message ?? null,
          };

      return {
        language: data.language ?? pistonLanguage,
        version: data.version,
        compile: data.compile ? mapStage(data.compile) : null,
        run,
      };
    } catch (error) {
      if (error instanceof CodeExecutionError) throw error;

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
          throw new CodeExecutionError(
            "Code execution service is unavailable. Is self-hosted Piston running on PISTON_BASE_URL?",
            503,
          );
        }
        if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
          throw new CodeExecutionError("Code execution request timed out", 504);
        }
        const status = error.response?.status ?? 502;
        const message =
          (error.response?.data as { message?: string } | undefined)?.message ||
          error.message ||
          "Code execution service error";
        throw new CodeExecutionError(String(message), status >= 400 ? status : 502);
      }

      throw new CodeExecutionError(
        error instanceof Error ? error.message : "Code execution failed",
        502,
      );
    }
  }
}

/** Shared default provider for /problems/run and future JudgeService. */
export const defaultExecutionProvider: CodeExecutionProvider =
  new PistonExecutionProvider();
