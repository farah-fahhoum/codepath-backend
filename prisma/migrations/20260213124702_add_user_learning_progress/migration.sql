-- CreateTable
CREATE TABLE "UserLearningProgress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "learningPathId" INTEGER NOT NULL,
    "currentModuleId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLearningProgress_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserLearningProgress" ADD CONSTRAINT "UserLearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLearningProgress" ADD CONSTRAINT "UserLearningProgress_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLearningProgress" ADD CONSTRAINT "UserLearningProgress_currentModuleId_fkey" FOREIGN KEY ("currentModuleId") REFERENCES "PathModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
