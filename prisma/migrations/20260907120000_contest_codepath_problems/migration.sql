-- Migrate ContestProblem from Codeforces catalog to CodePath problems.
-- Existing contest data is cleared because problem references cannot be migrated.

DELETE FROM "ContestSubmission";
DELETE FROM "ContestParticipant";
DELETE FROM "ContestProblem";
DELETE FROM "Contest";

ALTER TABLE "ContestProblem" DROP CONSTRAINT IF EXISTS "ContestProblem_problemId_fkey";
ALTER TABLE "ContestProblem" DROP CONSTRAINT IF EXISTS "ContestProblem_topicId_fkey";

ALTER TABLE "ContestProblem" DROP COLUMN "problemId";
ALTER TABLE "ContestProblem" DROP COLUMN "topicId";

ALTER TABLE "ContestProblem" ADD COLUMN "codePathProblemId" TEXT NOT NULL;
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_codePathProblemId_fkey"
  FOREIGN KEY ("codePathProblemId") REFERENCES "CodePathProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ContestProblem_contestId_codePathProblemId_key"
  ON "ContestProblem"("contestId", "codePathProblemId");

ALTER TABLE "ContestSubmission" ADD COLUMN "codePathSubmissionId" TEXT;
ALTER TABLE "ContestSubmission" ADD CONSTRAINT "ContestSubmission_codePathSubmissionId_fkey"
  FOREIGN KEY ("codePathSubmissionId") REFERENCES "CodePathSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
