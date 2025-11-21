-- CreateTable
CREATE TABLE "FavouriteProblem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalProblemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavouriteProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FavouriteProblem_userId_externalProblemId_platform_key" ON "FavouriteProblem"("userId", "externalProblemId", "platform");

-- AddForeignKey
ALTER TABLE "FavouriteProblem" ADD CONSTRAINT "FavouriteProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
