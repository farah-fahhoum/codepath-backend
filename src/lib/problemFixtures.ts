import * as fs from "fs";
import * as path from "path";

export interface ProblemFixtureTestCase {
  input: string;
  expectedOutput: string;
  isSample: boolean;
  sortOrder: number;
}

export interface ProblemFixture {
  slug: string;
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints?: string | null;
  rating: number;
  tags: string[];
  timeLimitMs?: number;
  memoryLimitMb?: number;
  status?: "DRAFT" | "PUBLISHED";
  testCases: ProblemFixtureTestCase[];
}

export interface ProblemFixturesFile {
  problems: ProblemFixture[];
}

export function fixturesPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "fixtures/codepath-problems.json"),
    path.resolve(__dirname, "../../fixtures/codepath-problems.json"),
    path.resolve(__dirname, "../../../fixtures/codepath-problems.json"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("fixtures/codepath-problems.json not found");
}

export function loadProblemFixtures(): ProblemFixture[] {
  const filePath = fixturesPath();
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ProblemFixturesFile;
  if (!Array.isArray(raw.problems) || raw.problems.length === 0) {
    throw new Error("fixtures/codepath-problems.json must contain a non-empty problems array");
  }
  return raw.problems;
}
