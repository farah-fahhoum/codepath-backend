-- CreateTable
CREATE TABLE "UserProblemAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalProblemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "bestExecutionTime" INTEGER,
    "lastAttempt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProblemAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSubmission" (
    "id" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "externalSubmissionId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "submissionTime" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "executionTime" INTEGER,
    "memoryUsed" INTEGER,
    "programmingLanguage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillLevel" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetRatingRange" TEXT NOT NULL,
    "expectedKnowledge" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkillAssessment" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "skillLevelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProblemAttempt_userId_externalProblemId_platform_key" ON "UserProblemAttempt"("userId", "externalProblemId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkillAssessment_userId_assessmentType_skillLevelId_key" ON "UserSkillAssessment"("userId", "assessmentType", "skillLevelId");

-- AddForeignKey
ALTER TABLE "UserProblemAttempt" ADD CONSTRAINT "UserProblemAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillAssessment" ADD CONSTRAINT "UserSkillAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillAssessment" ADD CONSTRAINT "UserSkillAssessment_skillLevelId_fkey" FOREIGN KEY ("skillLevelId") REFERENCES "SkillLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
