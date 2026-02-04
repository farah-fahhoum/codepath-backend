import { prisma } from "../lib/prisma";

export const getAllTopics = async (): Promise<
  { id: number; title: string; tags: string; rating: string; createdAt: Date; updatedAt: Date }[]
> => {
  return prisma.topic.findMany({
    select: {
      id: true,
      title: true,
      tags: true,
      rating: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { id: 'asc' },
  });
};

export const getTopicById = async (id: number): Promise<
  { id: number; title: string; tags: string; rating: string; createdAt: Date; updatedAt: Date } | null
> => {
  return prisma.topic.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      tags: true,
      rating: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getTopicsByModuleId = async (moduleId: number): Promise<
  { id: number; title: string; tags: string; rating: string }[]
> => {
  return prisma.topic.findMany({
    where: {
      pathModules: {
        some: {
          id: moduleId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      tags: true,
      rating: true,
    },
  });
};