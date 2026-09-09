-- Replace ProblemDifficulty enum with Codeforces-style integer rating

-- Add rating with a temporary default so existing rows can be updated
ALTER TABLE "CodePathProblem" ADD COLUMN "rating" INTEGER NOT NULL DEFAULT 800;

-- Map previous difficulty labels to approximate CF ratings
UPDATE "CodePathProblem" SET "rating" = 800 WHERE "difficulty" = 'EASY';
UPDATE "CodePathProblem" SET "rating" = 1400 WHERE "difficulty" = 'MEDIUM';
UPDATE "CodePathProblem" SET "rating" = 1900 WHERE "difficulty" = 'HARD';

-- Drop old difficulty column and index
DROP INDEX IF EXISTS "CodePathProblem_difficulty_idx";
ALTER TABLE "CodePathProblem" DROP COLUMN "difficulty";

-- Remove temporary default so new rows must set rating explicitly
ALTER TABLE "CodePathProblem" ALTER COLUMN "rating" DROP DEFAULT;

-- Drop unused enum
DROP TYPE "ProblemDifficulty";

-- Index for filtering by rating
CREATE INDEX "CodePathProblem_rating_idx" ON "CodePathProblem"("rating");
