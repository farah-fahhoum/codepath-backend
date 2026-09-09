export type ProblemPublishStatus = "DRAFT" | "PUBLISHED";

export interface CodePathProblemListItem {
  id: string;
  slug: string;
  title: string;
  rating: number;
  tags: string[];
  status: ProblemPublishStatus;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCaseCount?: number;
  sampleCaseCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemTestCaseSafe {
  id: string;
  input: string;
  expectedOutput?: string;
  isSample: boolean;
  sortOrder: number;
}

export interface CodePathProblemDetail {
  id: string;
  slug: string;
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints: string | null;
  rating: number;
  tags: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
  status: ProblemPublishStatus;
  testCases: ProblemTestCaseSafe[];
  createdAt: Date;
  updatedAt: Date;
}
