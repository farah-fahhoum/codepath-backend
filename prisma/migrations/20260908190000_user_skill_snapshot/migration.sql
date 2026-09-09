-- AlterTable
ALTER TABLE "UserProblemAttempt" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'external_sync';

-- CreateTable
CREATE TABLE "UserSkillSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "rating" INTEGER,
    "confidence" TEXT NOT NULL,
    "primarySource" TEXT NOT NULL,
    "sourcesJson" JSONB NOT NULL,
    "skillLevelId" INTEGER,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSkillSnapshot_userId_key" ON "UserSkillSnapshot"("userId");

-- CreateIndex
CREATE INDEX "UserSkillSnapshot_tier_idx" ON "UserSkillSnapshot"("tier");

-- CreateIndex
CREATE INDEX "UserSkillSnapshot_skillLevelId_idx" ON "UserSkillSnapshot"("skillLevelId");

-- AddForeignKey
ALTER TABLE "UserSkillSnapshot" ADD CONSTRAINT "UserSkillSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillSnapshot" ADD CONSTRAINT "UserSkillSnapshot_skillLevelId_fkey" FOREIGN KEY ("skillLevelId") REFERENCES "SkillLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
