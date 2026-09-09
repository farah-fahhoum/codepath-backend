-- AlterTable
ALTER TABLE "UserSkillSnapshot" ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "UserSkillSnapshot" ADD COLUMN "syncError" TEXT;
