import { prisma } from "../lib/prisma";

export const setMenteeManualSkillLevel = async (
  userId: string,
  skillLevelId: number,
): Promise<void> => {
  await prisma.userSkillAssessment.upsert({
    where: {
      userId_assessmentType_skillLevelId: {
        userId,
        assessmentType: "Manual",
        skillLevelId,
      },
    },
    create: {
      userId,
      assessmentType: "Manual",
      score: 0,
      skillLevelId,
    },
    update: { score: 0, updatedAt: new Date() },
  });
};

export const getAllSkillLevels = async (): Promise<
  {
    id: number;
    title: string;
    description: string;
    targetRatingRange: string;
    expectedKnowledge: string;
    createdAt: Date;
    updatedAt: Date;
  }[]
> => {
  return prisma.skillLevel.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      targetRatingRange: true,
      expectedKnowledge: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { id: "asc" },
  });
};

export const getSkillLevelById = async (
  id: number,
): Promise<{
  id: number;
  title: string;
  description: string;
  targetRatingRange: string;
  expectedKnowledge: string;
  createdAt: Date;
  updatedAt: Date;
} | null> => {
  return prisma.skillLevel.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      targetRatingRange: true,
      expectedKnowledge: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getSkillLevelByTitle = async (
  title: string,
): Promise<{
  id: number;
  title: string;
  description: string;
  targetRatingRange: string;
  expectedKnowledge: string;
  createdAt: Date;
  updatedAt: Date;
} | null> => {
  return prisma.skillLevel.findFirst({
    where: { title },
    select: {
      id: true,
      title: true,
      description: true,
      targetRatingRange: true,
      expectedKnowledge: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};
