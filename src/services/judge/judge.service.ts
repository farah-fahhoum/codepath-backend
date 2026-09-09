import {
  CodeExecutionError,
  CodeExecutionProvider,
  SupportedExecutionLanguage,
} from "../execution";
import { outputsMatch } from "./outputCompare";

export type JudgeVerdict = "AC" | "WA" | "TLE" | "RE" | "CE" | "JE";

export interface JudgeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  sortOrder: number;
}

export interface JudgeCaseResult {
  testCaseId: string;
  index: number;
  isSample: boolean;
  verdict: JudgeVerdict;
  /** Actual stdout — only included for sample cases (never leak hidden expected). */
  stdout?: string;
  stderr?: string;
  timeMs?: number | null;
}

export interface JudgeProblemMeta {
  id: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface JudgeRequest {
  problem: JudgeProblemMeta;
  testCases: JudgeTestCase[];
  language: SupportedExecutionLanguage;
  code: string;
  /** Soft cap on how many cases to run (default 20). */
  maxCases?: number;
}

export interface JudgeResult {
  verdict: JudgeVerdict;
  passedCount: number;
  totalCount: number;
  runtimeMs: number | null;
  message: string | null;
  stderr: string | null;
  caseResults: JudgeCaseResult[];
}

const MAX_CASES_DEFAULT = 20;

function isCompileFailure(compile: {
  code: number | null;
  status?: string | null;
  stderr: string;
} | null | undefined): boolean {
  if (!compile) return false;
  if (compile.status === "TO") return false; // handled separately
  return compile.code != null && compile.code !== 0;
}

/** Normalize provider stage timing to ms (self-hosted Piston returns ms ints). */
function stageTimeMs(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

function mapRunFailure(run: {
  code: number | null;
  signal: string | null;
  status?: string | null;
  stderr: string;
}): JudgeVerdict {
  if (run.status === "TO") return "TLE";
  if (run.signal) return "RE";
  if (run.code != null && run.code !== 0) return "RE";
  if (run.status === "RE" || run.status === "SG") return "RE";
  return "WA";
}

export class JudgeService {
  constructor(private readonly executionProvider: CodeExecutionProvider) {}

  async judge(request: JudgeRequest): Promise<JudgeResult> {
    const maxCases = request.maxCases ?? MAX_CASES_DEFAULT;
    const ordered = [...request.testCases].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    const cases = ordered.slice(0, maxCases);
    const totalCount = cases.length;

    if (totalCount === 0) {
      return {
        verdict: "JE",
        passedCount: 0,
        totalCount: 0,
        runtimeMs: null,
        message: "Problem has no test cases",
        stderr: null,
        caseResults: [],
      };
    }

    const runTimeoutMs = Math.min(
      Math.max(request.problem.timeLimitMs || 2000, 500),
      15000,
    );
    const runMemoryLimitBytes =
      request.problem.memoryLimitMb > 0
        ? request.problem.memoryLimitMb * 1024 * 1024
        : undefined;

    const caseResults: JudgeCaseResult[] = [];
    let passedCount = 0;
    let totalRuntimeMs = 0;
    let lastStderr: string | null = null;
    let finalVerdict: JudgeVerdict = "AC";
    let message: string | null = null;

    for (let i = 0; i < cases.length; i++) {
      const testCase = cases[i];
      let execution;
      try {
        execution = await this.executionProvider.execute({
          language: request.language,
          code: request.code,
          stdin: testCase.input,
          runTimeoutMs,
          runMemoryLimitBytes,
        });
      } catch (err) {
        const jeMessage =
          err instanceof CodeExecutionError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Execution provider failed";
        caseResults.push({
          testCaseId: testCase.id,
          index: i + 1,
          isSample: testCase.isSample,
          verdict: "JE",
          stderr: testCase.isSample ? jeMessage : undefined,
        });
        return {
          verdict: "JE",
          passedCount,
          totalCount,
          runtimeMs: totalRuntimeMs || null,
          message: jeMessage,
          stderr: jeMessage,
          caseResults,
        };
      }

      const compile = execution.compile;
      if (compile && isCompileFailure(compile)) {
        const compileErr =
          (compile.stderr || compile.message || "Compilation error").trim();
        caseResults.push({
          testCaseId: testCase.id,
          index: i + 1,
          isSample: testCase.isSample,
          verdict: "CE",
          stderr: compileErr || undefined,
          timeMs: stageTimeMs(compile.wallTimeMs),
        });
        return {
          verdict: "CE",
          passedCount: 0,
          totalCount,
          runtimeMs: stageTimeMs(compile.wallTimeMs),
          message: "Compilation error",
          stderr: compileErr || null,
          caseResults,
        };
      }

      // Compile-stage timeout
      if (compile?.status === "TO") {
        caseResults.push({
          testCaseId: testCase.id,
          index: i + 1,
          isSample: testCase.isSample,
          verdict: "TLE",
          timeMs: stageTimeMs(compile.wallTimeMs),
        });
        return {
          verdict: "TLE",
          passedCount: 0,
          totalCount,
          runtimeMs: stageTimeMs(compile.wallTimeMs),
          message: "Compilation timed out",
          stderr: compile.stderr || null,
          caseResults,
        };
      }

      const run = execution.run;
      const timeMs = stageTimeMs(run.wallTimeMs ?? run.cpuTimeMs ?? null);
      if (typeof timeMs === "number") totalRuntimeMs += timeMs;

      if (run.status === "TO") {
        caseResults.push({
          testCaseId: testCase.id,
          index: i + 1,
          isSample: testCase.isSample,
          verdict: "TLE",
          stderr: testCase.isSample ? run.stderr || undefined : undefined,
          timeMs,
        });
        finalVerdict = "TLE";
        message = `Time limit exceeded on test ${i + 1}`;
        lastStderr = run.stderr || null;
        break;
      }

      const failedRun =
        (run.code != null && run.code !== 0) ||
        !!run.signal ||
        run.status === "RE" ||
        run.status === "SG";

      if (failedRun) {
        const verdict = mapRunFailure(run);
        caseResults.push({
          testCaseId: testCase.id,
          index: i + 1,
          isSample: testCase.isSample,
          verdict,
          stdout: testCase.isSample ? run.stdout : undefined,
          stderr: testCase.isSample ? run.stderr || undefined : undefined,
          timeMs,
        });
        finalVerdict = verdict;
        message =
          verdict === "TLE"
            ? `Time limit exceeded on test ${i + 1}`
            : `Runtime error on test ${i + 1}`;
        lastStderr = run.stderr || null;
        break;
      }

      if (!outputsMatch(run.stdout, testCase.expectedOutput)) {
        caseResults.push({
          testCaseId: testCase.id,
          index: i + 1,
          isSample: testCase.isSample,
          verdict: "WA",
          stdout: testCase.isSample ? run.stdout : undefined,
          stderr: testCase.isSample ? run.stderr || undefined : undefined,
          timeMs,
        });
        finalVerdict = "WA";
        message = `Wrong answer on test ${i + 1}`;
        lastStderr = run.stderr || null;
        break;
      }

      passedCount += 1;
      caseResults.push({
        testCaseId: testCase.id,
        index: i + 1,
        isSample: testCase.isSample,
        verdict: "AC",
        stdout: testCase.isSample ? run.stdout : undefined,
        timeMs,
      });
    }

    return {
      verdict: finalVerdict,
      passedCount,
      totalCount,
      runtimeMs: totalRuntimeMs || null,
      message: finalVerdict === "AC" ? "Accepted" : message,
      stderr: finalVerdict === "AC" ? null : lastStderr,
      caseResults,
    };
  }
}
