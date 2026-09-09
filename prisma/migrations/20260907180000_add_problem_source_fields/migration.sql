-- CreateEnum
CREATE TYPE "ProblemSource" AS ENUM ('INTERNAL', 'CSES', 'CODEFORCES', 'DMOJ', 'KATTIS', 'USACO');

-- CreateEnum
CREATE TYPE "ProblemCheckerType" AS ENUM ('STANDARD', 'FLOATING_POINT', 'MULTIPLE_VALID_OUTPUT', 'INTERACTIVE', 'ANY_ORDER', 'SPECIAL_JUDGE');

-- AlterTable
ALTER TABLE "CodePathProblem" ADD COLUMN "source" "ProblemSource" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "CodePathProblem" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "CodePathProblem" ADD COLUMN "checkerType" "ProblemCheckerType" NOT NULL DEFAULT 'STANDARD';

-- CreateIndex
CREATE INDEX "CodePathProblem_source_idx" ON "CodePathProblem"("source");

-- CreateIndex
CREATE UNIQUE INDEX "CodePathProblem_source_sourceId_key" ON "CodePathProblem"("source", "sourceId");
