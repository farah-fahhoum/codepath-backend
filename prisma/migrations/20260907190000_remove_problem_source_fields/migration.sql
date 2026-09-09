-- DropIndex
DROP INDEX IF EXISTS "CodePathProblem_source_sourceId_key";
DROP INDEX IF EXISTS "CodePathProblem_source_idx";

-- AlterTable
ALTER TABLE "CodePathProblem" DROP COLUMN IF EXISTS "source";
ALTER TABLE "CodePathProblem" DROP COLUMN IF EXISTS "sourceId";
ALTER TABLE "CodePathProblem" DROP COLUMN IF EXISTS "checkerType";

-- DropEnum
DROP TYPE IF EXISTS "ProblemSource";
DROP TYPE IF EXISTS "ProblemCheckerType";
