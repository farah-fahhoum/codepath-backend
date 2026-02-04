import { prisma } from "../lib/prisma";

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
