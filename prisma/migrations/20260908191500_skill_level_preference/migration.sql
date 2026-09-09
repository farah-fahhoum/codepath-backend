-- AlterTable
ALTER TABLE "UserSkillSnapshot" ADD COLUMN "levelPreference" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "UserSkillSnapshot" ADD COLUMN "assessmentReasoning" TEXT;
