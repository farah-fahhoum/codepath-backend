import { prisma } from "../lib/prisma";

const topicSelect = {
  id: true,
  title: true,
  tags: true,
  rating: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type TopicRecord = {
  id: number;
  title: string;
  tags: string;
  rating: string;
  createdAt: Date;
  updatedAt: Date;
};

export class TopicInUseError extends Error {
  constructor(moduleCount: number) {
    super(
      `Topic is used by ${moduleCount} roadmap module(s). Reassign or remove those modules first.`,
    );
    this.name = "TopicInUseError";
  }
}

export const getAllTopics = async (): Promise<TopicRecord[]> => {
  return prisma.topic.findMany({
    select: topicSelect,
    orderBy: { title: "asc" },
  });
};

export const getTopicById = async (id: number): Promise<TopicRecord | null> => {
  return prisma.topic.findUnique({
    where: { id },
    select: topicSelect,
  });
};

export const createTopic = async (data: {
  title: string;
  tags: string;
  rating: string;
}): Promise<TopicRecord> => {
  return prisma.topic.create({
    data,
    select: topicSelect,
  });
};

export const updateTopic = async (
  id: number,
  data: { title?: string; tags?: string; rating?: string },
): Promise<TopicRecord> => {
  return prisma.topic.update({
    where: { id },
    data,
    select: topicSelect,
  });
};

export const deleteTopic = async (id: number): Promise<void> => {
  const moduleCount = await prisma.pathModule.count({ where: { topicId: id } });
  if (moduleCount > 0) {
    throw new TopicInUseError(moduleCount);
  }

  const snippetCount = await prisma.solutionSnippet.count({
    where: { topicId: id },
  });
  if (snippetCount > 0) {
    throw new Error(
      `Topic is used by ${snippetCount} reference snippet(s). Remove those first.`,
    );
  }

  await prisma.topic.delete({ where: { id } });
};

export const findTopicByTitle = async (
  title: string,
): Promise<TopicRecord | null> => {
  return prisma.topic.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    select: topicSelect,
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