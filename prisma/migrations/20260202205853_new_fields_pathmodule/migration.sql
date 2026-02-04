-- AlterTable
ALTER TABLE "PathModule" ADD COLUMN     "estimatedHours" INTEGER,
ADD COLUMN     "learningObjectives" JSONB,
ADD COLUMN     "moduleOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "successCriteria" JSONB,
ADD COLUMN     "topicId" INTEGER;
