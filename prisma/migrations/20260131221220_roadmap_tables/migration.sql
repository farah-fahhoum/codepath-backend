-- CreateTable
CREATE TABLE "LearningPath" (
    "id" SERIAL NOT NULL,
    "targetSkillLevelId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathModule" (
    "id" SERIAL NOT NULL,
    "learningPathId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleResource" (
    "id" SERIAL NOT NULL,
    "pathModuleId" INTEGER NOT NULL,
    "resourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleProblem" (
    "id" SERIAL NOT NULL,
    "pathModuleId" INTEGER NOT NULL,
    "externalProblemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleProblem_pathModuleId_externalProblemId_platform_key" ON "ModuleProblem"("pathModuleId", "externalProblemId", "platform");

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_targetSkillLevelId_fkey" FOREIGN KEY ("targetSkillLevelId") REFERENCES "SkillLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathModule" ADD CONSTRAINT "PathModule_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleResource" ADD CONSTRAINT "ModuleResource_pathModuleId_fkey" FOREIGN KEY ("pathModuleId") REFERENCES "PathModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleProblem" ADD CONSTRAINT "ModuleProblem_pathModuleId_fkey" FOREIGN KEY ("pathModuleId") REFERENCES "PathModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
