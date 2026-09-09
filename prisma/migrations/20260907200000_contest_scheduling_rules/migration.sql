-- AlterTable
ALTER TABLE "Contest" ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Contest" ADD COLUMN "scheduledStartTime" TIMESTAMP(3);
ALTER TABLE "Contest" ADD COLUMN "rulesOfEngagement" TEXT NOT NULL DEFAULT '[]';
