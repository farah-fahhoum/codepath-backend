import { prisma } from "../lib/prisma";
import type { ProblemPublishStatus, SubmissionVerdict } from "../../generated/prisma/client";

const testCasesOrder = [{ sortOrder: "asc" as const }, { id: "asc" as const }];

export type ProblemListSort = "rating_asc" | "rating_desc" | "title_asc";

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export const getPublishedCodePathAvailableTagsFromDB = async (): Promise<string[]> => {
  const rows = await prisma.codePathProblem.findMany({
    where: { status: "PUBLISHED" },
    select: { tags: true },
  });
  const tagSet = new Set<string>();
  for (const row of rows) {
    parseTags(row.tags).forEach((t) => tagSet.add(t));
  }
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
};

export const getCodePathProblemByIdFromDB = async (id: string) => {
  return prisma.codePathProblem.findUnique({
    where: { id },
    include: {
      testCases: {
        orderBy: testCasesOrder,
      },
    },
  });
};

export const getPublishedCodePathProblemsByIdsFromDB = async (ids: string[]) => {
  if (ids.length === 0) return [];
  return prisma.codePathProblem.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      rating: true,
      tags: true,
    },
  });
};

export const listPublishedCodePathProblemsFromDB = async (params: {
  page: number;
  limit: number;
  minRating?: number;
  maxRating?: number;
  tag?: string;
  search?: string;
  sort?: ProblemListSort;
}) => {
  const { page, limit, minRating, maxRating, tag, search, sort = "rating_asc" } = params;

  const where: {
    status: "PUBLISHED";
    rating?: { gte?: number; lte?: number };
    tags?: { contains: string };
    OR?: Array<
      | { title: { contains: string; mode: "insensitive" } }
      | { slug: { contains: string; mode: "insensitive" } }
      | { tags: { contains: string; mode: "insensitive" } }
    >;
  } = { status: "PUBLISHED" };

  if (minRating != null || maxRating != null) {
    where.rating = {};
    if (minRating != null) where.rating.gte = minRating;
    if (maxRating != null) where.rating.lte = maxRating;
  }
  if (tag) where.tags = { contains: `"${tag}"` };

  const q = search?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { tags: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy =
    sort === "rating_desc"
      ? [{ rating: "desc" as const }, { title: "asc" as const }]
      : sort === "title_asc"
        ? [{ title: "asc" as const }]
        : [{ rating: "asc" as const }, { title: "asc" as const }];

  const [items, total, availableTags] = await Promise.all([
    prisma.codePathProblem.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        testCases: {
          select: { id: true, isSample: true },
        },
      },
    }),
    prisma.codePathProblem.count({ where }),
    getPublishedCodePathAvailableTagsFromDB(),
  ]);

  return { items, total, page, limit, availableTags };
};

export const listAllCodePathProblemsForAdminFromDB = async (params: {
  page: number;
  limit: number;
  status?: ProblemPublishStatus;
  search?: string;
}) => {
  const { page, limit, status, search } = params;
  const where: {
    status?: ProblemPublishStatus;
    OR?: Array<{ title: { contains: string; mode: "insensitive" } } | { slug: { contains: string; mode: "insensitive" } }>;
  } = {};
  if (status) where.status = status;
  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.codePathProblem.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        testCases: {
          select: { id: true, isSample: true },
        },
      },
    }),
    prisma.codePathProblem.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const createCodePathProblemInDB = async (data: {
  slug: string;
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints?: string | null;
  rating: number;
  tags: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  createdByUserId: string;
}) => {
  return prisma.codePathProblem.create({
    data: {
      ...data,
      status: "DRAFT",
    },
    include: {
      testCases: {
        orderBy: testCasesOrder,
      },
    },
  });
};

export const updateCodePathProblemInDB = async (
  id: string,
  data: Partial<{
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
  }>,
) => {
  return prisma.codePathProblem.update({
    where: { id },
    data,
    include: {
      testCases: {
        orderBy: testCasesOrder,
      },
    },
  });
};

export const deleteCodePathProblemFromDB = async (id: string) => {
  return prisma.codePathProblem.delete({ where: { id } });
};

export const setCodePathProblemStatusInDB = async (
  id: string,
  status: ProblemPublishStatus,
) => {
  return prisma.codePathProblem.update({
    where: { id },
    data: { status },
    include: {
      testCases: {
        orderBy: testCasesOrder,
      },
    },
  });
};

export const createProblemTestCaseInDB = async (data: {
  problemId: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  sortOrder: number;
}) => {
  return prisma.problemTestCase.create({ data });
};

export const updateProblemTestCaseInDB = async (
  caseId: string,
  data: Partial<{
    input: string;
    expectedOutput: string;
    isSample: boolean;
    sortOrder: number;
  }>,
) => {
  return prisma.problemTestCase.update({
    where: { id: caseId },
    data,
  });
};

export const deleteProblemTestCaseFromDB = async (caseId: string) => {
  return prisma.problemTestCase.delete({ where: { id: caseId } });
};

export const getProblemTestCaseByIdFromDB = async (caseId: string) => {
  return prisma.problemTestCase.findUnique({ where: { id: caseId } });
};

export const slugExistsInDB = async (slug: string, excludeId?: string) => {
  const existing = await prisma.codePathProblem.findUnique({ where: { slug } });
  if (!existing) return false;
  if (excludeId && existing.id === excludeId) return false;
  return true;
};

export const getPublishedCodePathProblemByIdFromDB = async (id: string) => {
  return prisma.codePathProblem.findFirst({
    where: { id, status: "PUBLISHED" },
    include: {
      testCases: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
};

export const createCodePathSubmissionInDB = async (data: {
  problemId: string;
  userId: string;
  language: string;
  code: string;
  verdict: SubmissionVerdict;
  passedCount: number;
  totalCount: number;
  runtimeMs?: number | null;
  message?: string | null;
  stderr?: string | null;
}) => {
  return prisma.codePathSubmission.create({
    data: {
      problemId: data.problemId,
      userId: data.userId,
      language: data.language,
      code: data.code,
      verdict: data.verdict,
      passedCount: data.passedCount,
      totalCount: data.totalCount,
      runtimeMs: data.runtimeMs ?? null,
      message: data.message ?? null,
      stderr: data.stderr ?? null,
    },
  });
};

export const getMyCodePathSubmissionsFromDB = async (
  problemId: string,
  userId: string,
) => {
  return prisma.codePathSubmission.findMany({
    where: { problemId, userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      problemId: true,
      language: true,
      verdict: true,
      passedCount: true,
      totalCount: true,
      runtimeMs: true,
      message: true,
      createdAt: true,
      // intentionally omit code/stderr list for brevity; detail endpoint returns more
    },
  });
};

export const getCodePathSubmissionByIdFromDB = async (id: string) => {
  return prisma.codePathSubmission.findUnique({
    where: { id },
    include: {
      problem: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
  });
};
