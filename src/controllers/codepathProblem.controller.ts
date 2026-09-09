import { Request, Response } from "express";
import Joi from "joi";
import { ok } from "../lib/response";
import { problemListQuerySchema } from "../lib/problemListQuery";
import { defaultExecutionProvider, SupportedExecutionLanguage } from "../services/execution";
import { JudgeService } from "../services/judge";
import { recordProblemAttempt } from "../repositories/userProblemAttempt.repo";
import {
  createCodePathProblemInDB,
  createCodePathSubmissionInDB,
  createProblemTestCaseInDB,
  deleteCodePathProblemFromDB,
  deleteProblemTestCaseFromDB,
  getCodePathProblemByIdFromDB,
  getCodePathSubmissionByIdFromDB,
  getMyCodePathSubmissionsFromDB,
  getProblemTestCaseByIdFromDB,
  getPublishedCodePathProblemByIdFromDB,
  listAllCodePathProblemsForAdminFromDB,
  listPublishedCodePathProblemsFromDB,
  setCodePathProblemStatusInDB,
  slugExistsInDB,
  updateCodePathProblemInDB,
  updateProblemTestCaseInDB,
} from "../repositories/codepathProblem.repo";
import { checkUserRoleForAuth } from "../repositories/user.repo";
import type {
  CodePathProblemDetail,
  CodePathProblemListItem,
  ProblemTestCaseSafe,
} from "../types/codepathProblem.type";

const judgeService = new JudgeService(defaultExecutionProvider);

const SUPPORTED_LANGUAGES: SupportedExecutionLanguage[] = [
  "cpp",
  "java",
  "python",
  "javascript",
];

const submitBodySchema = Joi.object({
  code: Joi.string().min(1).max(200_000).required(),
  language: Joi.string()
    .valid(...SUPPORTED_LANGUAGES)
    .required(),
});

const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

const caseIdParamSchema = Joi.object({
  id: Joi.string().required(),
  caseId: Joi.string().required(),
});

const submissionIdParamSchema = Joi.object({
  submissionId: Joi.string().required(),
});

const problemBodySchema = Joi.object({
  slug: Joi.string().min(1).max(120).optional(),
  title: Joi.string().min(1).max(200).required(),
  statement: Joi.string().min(1).max(100_000).required(),
  inputDescription: Joi.string().min(1).max(20_000).required(),
  outputDescription: Joi.string().min(1).max(20_000).required(),
  constraints: Joi.string().max(20_000).allow("", null).optional(),
  rating: Joi.number().integer().min(800).max(3500).required(),
  tags: Joi.array().items(Joi.string().min(1).max(50)).min(1).required(),
  timeLimitMs: Joi.number().integer().min(100).max(30_000).default(2000),
  memoryLimitMb: Joi.number().integer().min(16).max(1024).default(256),
});

const problemUpdateBodySchema = Joi.object({
  slug: Joi.string().min(1).max(120).optional(),
  title: Joi.string().min(1).max(200).optional(),
  statement: Joi.string().min(1).max(100_000).optional(),
  inputDescription: Joi.string().min(1).max(20_000).optional(),
  outputDescription: Joi.string().min(1).max(20_000).optional(),
  constraints: Joi.string().max(20_000).allow("", null).optional(),
  rating: Joi.number().integer().min(800).max(3500).optional(),
  tags: Joi.array().items(Joi.string().min(1).max(50)).min(1).optional(),
  timeLimitMs: Joi.number().integer().min(100).max(30_000).optional(),
  memoryLimitMb: Joi.number().integer().min(16).max(1024).optional(),
});

const testCaseBodySchema = Joi.object({
  input: Joi.string().min(1).max(50_000).required(),
  expectedOutput: Joi.string().min(1).max(50_000).required(),
  isSample: Joi.boolean().default(false),
  sortOrder: Joi.number().integer().min(0).max(10_000).default(0),
});

const testCaseUpdateBodySchema = Joi.object({
  input: Joi.string().min(1).max(50_000).optional(),
  expectedOutput: Joi.string().min(1).max(50_000).optional(),
  isSample: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).max(10_000).optional(),
});

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base || "problem";
  let suffix = 0;
  while (await slugExistsInDB(candidate, excludeId)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function mapTestCaseForRole(
  tc: {
    id: string;
    input: string;
    expectedOutput: string;
    isSample: boolean;
    sortOrder: number;
  },
  isAdmin: boolean,
): ProblemTestCaseSafe {
  const base = {
    id: tc.id,
    input: tc.input,
    isSample: tc.isSample,
    sortOrder: tc.sortOrder,
  };
  if (isAdmin || tc.isSample) {
    return { ...base, expectedOutput: tc.expectedOutput };
  }
  return base;
}

function mapProblemListItem(
  problem: {
    id: string;
    slug: string;
    title: string;
    rating: number;
    tags: string;
    status: "DRAFT" | "PUBLISHED";
    timeLimitMs: number;
    memoryLimitMb: number;
    createdAt: Date;
    updatedAt: Date;
    testCases?: Array<{ id: string; isSample: boolean }>;
  },
): CodePathProblemListItem {
  const testCases = problem.testCases ?? [];
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    rating: problem.rating,
    tags: parseTags(problem.tags),
    status: problem.status,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    testCaseCount: testCases.length,
    sampleCaseCount: testCases.filter((tc) => tc.isSample).length,
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
  };
}

function mapProblemDetail(
  problem: {
    id: string;
    slug: string;
    title: string;
    statement: string;
    inputDescription: string;
    outputDescription: string;
    constraints: string | null;
    rating: number;
    tags: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    status: "DRAFT" | "PUBLISHED";
    createdAt: Date;
    updatedAt: Date;
    testCases: Array<{
      id: string;
      input: string;
      expectedOutput: string;
      isSample: boolean;
      sortOrder: number;
    }>;
  },
  isAdmin: boolean,
): CodePathProblemDetail {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    statement: problem.statement,
    inputDescription: problem.inputDescription,
    outputDescription: problem.outputDescription,
    constraints: problem.constraints,
    rating: problem.rating,
    tags: parseTags(problem.tags),
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    status: problem.status,
    testCases: problem.testCases.map((tc) => mapTestCaseForRole(tc, isAdmin)),
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
  };
}

/**
 * GET /codepath-problems — published list for mentees (and admins).
 */
export const listCodePathProblems = async (req: Request, res: Response) => {
  try {
    const { value, error } = problemListQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const result = await listPublishedCodePathProblemsFromDB({
      page: value.page,
      limit: value.limit,
      minRating: value.minRating ?? undefined,
      maxRating: value.maxRating ?? undefined,
      tag: value.tag && value.tag !== "all" ? value.tag : undefined,
      search: value.search ?? undefined,
      sort: value.sort,
    });
    const totalPages = Math.max(1, Math.ceil(result.total / value.limit));
    return res.status(200).json(
      ok({
        page: value.page,
        limit: value.limit,
        total: result.total,
        totalPages,
        availableTags: result.availableTags,
        items: result.items.map(mapProblemListItem),
      }),
    );
  } catch (error) {
    console.error("listCodePathProblems error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * GET /codepath-problems/admin/all — all problems for admin.
 */
export const listAllCodePathProblemsAdmin = async (
  req: Request,
  res: Response,
) => {
  try {
    const querySchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid("DRAFT", "PUBLISHED").optional(),
      search: Joi.string().max(200).optional(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const result = await listAllCodePathProblemsForAdminFromDB(value);
    const totalPages = Math.max(1, Math.ceil(result.total / value.limit));
    return res.status(200).json(
      ok({
        page: value.page,
        limit: value.limit,
        total: result.total,
        totalPages,
        items: result.items.map(mapProblemListItem),
      }),
    );
  } catch (error) {
    console.error("listAllCodePathProblemsAdmin error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * GET /codepath-problems/:id — problem detail; mentees see samples only.
 */
export const getCodePathProblemById = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined by authorize middleware
    const userId = req.user?.id as string;
    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const role = await checkUserRoleForAuth(userId);
    const isAdmin = role?.role === "Admin";

    const problem = await getCodePathProblemByIdFromDB(params.id);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }
    if (!isAdmin && problem.status !== "PUBLISHED") {
      return res.status(404).json({ message: "Problem not found" });
    }

    return res.status(200).json(ok(mapProblemDetail(problem, isAdmin)));
  } catch (error) {
    console.error("getCodePathProblemById error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /codepath-problems — create draft problem (admin).
 */
export const createCodePathProblem = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined by authorize middleware
    const userId = req.user?.id as string;
    const { value, error } = problemBodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const baseSlug = slugifyTitle(value.slug ?? value.title);
    const slug = await ensureUniqueSlug(baseSlug);

    const problem = await createCodePathProblemInDB({
      slug,
      title: value.title,
      statement: value.statement,
      inputDescription: value.inputDescription,
      outputDescription: value.outputDescription,
      constraints: value.constraints ?? null,
      rating: value.rating,
      tags: JSON.stringify(value.tags),
      timeLimitMs: value.timeLimitMs,
      memoryLimitMb: value.memoryLimitMb,
      createdByUserId: userId,
    });

    return res
      .status(201)
      .json(ok(mapProblemDetail(problem, true), "Problem created"));
  } catch (error) {
    console.error("createCodePathProblem error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * PUT /codepath-problems/:id — update problem (admin).
 */
export const updateCodePathProblem = async (req: Request, res: Response) => {
  try {
    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const { value: body, error: bodyError } = problemUpdateBodySchema.validate(
      req.body,
    );
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const existing = await getCodePathProblemByIdFromDB(params.id);
    if (!existing) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.statement !== undefined) updateData.statement = body.statement;
    if (body.inputDescription !== undefined) {
      updateData.inputDescription = body.inputDescription;
    }
    if (body.outputDescription !== undefined) {
      updateData.outputDescription = body.outputDescription;
    }
    if (body.constraints !== undefined) {
      updateData.constraints = body.constraints || null;
    }
    if (body.rating !== undefined) updateData.rating = body.rating;
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
    if (body.timeLimitMs !== undefined) updateData.timeLimitMs = body.timeLimitMs;
    if (body.memoryLimitMb !== undefined) {
      updateData.memoryLimitMb = body.memoryLimitMb;
    }
    if (body.slug !== undefined) {
      const slug = slugifyTitle(body.slug);
      if (await slugExistsInDB(slug, params.id)) {
        return res.status(400).json({ message: "Slug already exists" });
      }
      updateData.slug = slug;
    }

    const problem = await updateCodePathProblemInDB(params.id, updateData);
    return res
      .status(200)
      .json(ok(mapProblemDetail(problem, true), "Problem updated"));
  } catch (error) {
    console.error("updateCodePathProblem error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * DELETE /codepath-problems/:id — delete problem (admin).
 */
export const deleteCodePathProblem = async (req: Request, res: Response) => {
  try {
    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const existing = await getCodePathProblemByIdFromDB(params.id);
    if (!existing) {
      return res.status(404).json({ message: "Problem not found" });
    }

    await deleteCodePathProblemFromDB(params.id);
    return res.status(200).json(ok(null, "Problem deleted"));
  } catch (error) {
    console.error("deleteCodePathProblem error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /codepath-problems/:id/publish
 */
export const publishCodePathProblem = async (req: Request, res: Response) => {
  try {
    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const existing = await getCodePathProblemByIdFromDB(params.id);
    if (!existing) {
      return res.status(404).json({ message: "Problem not found" });
    }
    if (existing.testCases.length === 0) {
      return res
        .status(400)
        .json({ message: "Add at least one test case before publishing" });
    }

    const problem = await setCodePathProblemStatusInDB(params.id, "PUBLISHED");
    return res
      .status(200)
      .json(ok(mapProblemDetail(problem, true), "Problem published"));
  } catch (error) {
    console.error("publishCodePathProblem error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /codepath-problems/:id/unpublish
 */
export const unpublishCodePathProblem = async (req: Request, res: Response) => {
  try {
    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const existing = await getCodePathProblemByIdFromDB(params.id);
    if (!existing) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const problem = await setCodePathProblemStatusInDB(params.id, "DRAFT");
    return res
      .status(200)
      .json(ok(mapProblemDetail(problem, true), "Problem unpublished"));
  } catch (error) {
    console.error("unpublishCodePathProblem error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /codepath-problems/:id/test-cases
 */
export const createProblemTestCase = async (req: Request, res: Response) => {
  try {
    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const { value: body, error: bodyError } = testCaseBodySchema.validate(
      req.body,
    );
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const existing = await getCodePathProblemByIdFromDB(params.id);
    if (!existing) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const testCase = await createProblemTestCaseInDB({
      problemId: params.id,
      input: body.input,
      expectedOutput: body.expectedOutput,
      isSample: body.isSample,
      sortOrder: body.sortOrder,
    });

    return res.status(201).json(
      ok(
        {
          id: testCase.id,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          isSample: testCase.isSample,
          sortOrder: testCase.sortOrder,
        },
        "Test case created",
      ),
    );
  } catch (error) {
    console.error("createProblemTestCase error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * PUT /codepath-problems/:id/test-cases/:caseId
 */
export const updateProblemTestCase = async (req: Request, res: Response) => {
  try {
    const { value: params, error: paramError } = caseIdParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const { value: body, error: bodyError } = testCaseUpdateBodySchema.validate(
      req.body,
    );
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const testCase = await getProblemTestCaseByIdFromDB(params.caseId);
    if (!testCase || testCase.problemId !== params.id) {
      return res.status(404).json({ message: "Test case not found" });
    }

    const updated = await updateProblemTestCaseInDB(params.caseId, body);
    return res.status(200).json(
      ok(
        {
          id: updated.id,
          input: updated.input,
          expectedOutput: updated.expectedOutput,
          isSample: updated.isSample,
          sortOrder: updated.sortOrder,
        },
        "Test case updated",
      ),
    );
  } catch (error) {
    console.error("updateProblemTestCase error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * DELETE /codepath-problems/:id/test-cases/:caseId
 */
export const deleteProblemTestCase = async (req: Request, res: Response) => {
  try {
    const { value: params, error: paramError } = caseIdParamSchema.validate(
      req.params,
    );
    if (paramError) return res.status(400).json({ message: paramError.message });

    const testCase = await getProblemTestCaseByIdFromDB(params.caseId);
    if (!testCase || testCase.problemId !== params.id) {
      return res.status(404).json({ message: "Test case not found" });
    }

    await deleteProblemTestCaseFromDB(params.caseId);
    return res.status(200).json(ok(null, "Test case deleted"));
  } catch (error) {
    console.error("deleteProblemTestCase error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /codepath-problems/:id/submit
 * Judge against all server-side test cases; never return hidden expected output.
 */
export const submitCodePathProblem = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined by authorize middleware
    const userId = req.user?.id as string;

    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) {
      return res.status(400).json({ message: paramError.message });
    }

    const { value: body, error: bodyError } = submitBodySchema.validate(
      req.body,
    );
    if (bodyError) {
      return res.status(400).json({ message: bodyError.message });
    }

    const problem = await getPublishedCodePathProblemByIdFromDB(params.id);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const language = body.language as SupportedExecutionLanguage;
    const judgeResult = await judgeService.judge({
      problem: {
        id: problem.id,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      },
      testCases: problem.testCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
        sortOrder: tc.sortOrder,
      })),
      language,
      code: body.code,
      maxCases: problem.testCases.length,
    });

    const submission = await createCodePathSubmissionInDB({
      problemId: problem.id,
      userId,
      language,
      code: body.code,
      verdict: judgeResult.verdict,
      passedCount: judgeResult.passedCount,
      totalCount: judgeResult.totalCount,
      runtimeMs: judgeResult.runtimeMs,
      message: judgeResult.message,
      stderr: judgeResult.stderr,
    });

    await recordProblemAttempt({
      userId,
      externalProblemId: problem.id,
      platform: "CodePath",
      solved: judgeResult.verdict === "AC",
      source: "practice",
      executionTimeMs: judgeResult.runtimeMs,
    });

    // Safe payload: sample case stdout/stderr only; never expectedOutput
    const sampleCaseResults = judgeResult.caseResults
      .filter((c) => c.isSample)
      .map((c) => ({
        index: c.index,
        verdict: c.verdict,
        stdout: c.stdout,
        stderr: c.stderr,
        timeMs: c.timeMs,
      }));

    return res.status(201).json(
      ok(
        {
          submission: {
            id: submission.id,
            problemId: submission.problemId,
            language: submission.language,
            verdict: submission.verdict,
            passedCount: submission.passedCount,
            totalCount: submission.totalCount,
            runtimeMs: submission.runtimeMs,
            message: submission.message,
            createdAt: submission.createdAt,
          },
          sampleCaseResults,
        },
        judgeResult.message || "Judged",
      ),
    );
  } catch (error) {
    console.error("submitCodePathProblem error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * GET /codepath-problems/:id/submissions/me
 */
export const getMyCodePathSubmissions = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined by authorize middleware
    const userId = req.user?.id as string;

    const { value: params, error: paramError } = idParamSchema.validate(
      req.params,
    );
    if (paramError) {
      return res.status(400).json({ message: paramError.message });
    }

    const problem = await getPublishedCodePathProblemByIdFromDB(params.id);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const submissions = await getMyCodePathSubmissionsFromDB(
      problem.id,
      userId,
    );
    return res.status(200).json(ok({ submissions }));
  } catch (error) {
    console.error("getMyCodePathSubmissions error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * GET /codepath-problems/submissions/:submissionId
 * Owner or Admin. Never includes hidden expected outputs.
 */
export const getCodePathSubmissionById = async (
  req: Request,
  res: Response,
) => {
  try {
    // @ts-expect-error userId is defined by authorize middleware
    const userId = req.user?.id as string;

    const { value: params, error: paramError } =
      submissionIdParamSchema.validate(req.params);
    if (paramError) {
      return res.status(400).json({ message: paramError.message });
    }

    const submission = await getCodePathSubmissionByIdFromDB(
      params.submissionId,
    );
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const role = await checkUserRoleForAuth(userId);
    const isOwner = submission.userId === userId;
    const isAdmin = role?.role === "Admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json(
      ok({
        id: submission.id,
        problemId: submission.problemId,
        problem: submission.problem,
        language: submission.language,
        code: submission.code,
        verdict: submission.verdict,
        passedCount: submission.passedCount,
        totalCount: submission.totalCount,
        runtimeMs: submission.runtimeMs,
        message: submission.message,
        // stderr only for owner/admin on their own view; still no test expecteds
        stderr: submission.stderr,
        createdAt: submission.createdAt,
        user: isAdmin
          ? submission.user
          : { id: submission.user.id, username: submission.user.username },
      }),
    );
  } catch (error) {
    console.error("getCodePathSubmissionById error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
