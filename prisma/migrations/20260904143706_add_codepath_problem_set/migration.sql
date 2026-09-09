-- CreateEnum
CREATE TYPE "ProblemPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProblemDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SubmissionVerdict" AS ENUM ('AC', 'WA', 'TLE', 'RE', 'CE', 'JE');

-- CreateTable
CREATE TABLE "CodePathProblem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "inputDescription" TEXT NOT NULL,
    "outputDescription" TEXT NOT NULL,
    "constraints" TEXT,
    "difficulty" "ProblemDifficulty" NOT NULL,
    "tags" TEXT NOT NULL,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 256,
    "status" "ProblemPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodePathProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemTestCase" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodePathSubmission" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "verdict" "SubmissionVerdict" NOT NULL,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "runtimeMs" INTEGER,
    "message" TEXT,
    "stderr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodePathSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodePathProblem_slug_key" ON "CodePathProblem"("slug");

-- CreateIndex
CREATE INDEX "CodePathProblem_status_idx" ON "CodePathProblem"("status");

-- CreateIndex
CREATE INDEX "CodePathProblem_difficulty_idx" ON "CodePathProblem"("difficulty");

-- CreateIndex
CREATE INDEX "ProblemTestCase_problemId_sortOrder_idx" ON "ProblemTestCase"("problemId", "sortOrder");

-- CreateIndex
CREATE INDEX "CodePathSubmission_userId_problemId_createdAt_idx" ON "CodePathSubmission"("userId", "problemId", "createdAt");

-- CreateIndex
CREATE INDEX "CodePathSubmission_problemId_createdAt_idx" ON "CodePathSubmission"("problemId", "createdAt");

-- AddForeignKey
ALTER TABLE "CodePathProblem" ADD CONSTRAINT "CodePathProblem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemTestCase" ADD CONSTRAINT "ProblemTestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "CodePathProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodePathSubmission" ADD CONSTRAINT "CodePathSubmission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "CodePathProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodePathSubmission" ADD CONSTRAINT "CodePathSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
