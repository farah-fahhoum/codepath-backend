import { prisma } from "../lib/prisma";
import { SolutionSnippet } from "../types/reference.type";

const snippetInclude = {
  topic: { select: { id: true, title: true } },
} as const;

const toSnippet = (snippet: any): SolutionSnippet => ({
  id: snippet.id,
  userId: snippet.userId,
  topicId: snippet.topicId,
  title: snippet.title,
  language: snippet.language,
  code: snippet.code,
  notes: snippet.notes,
  tags: snippet.tags,
  isPublic: snippet.isPublic,
  createdAt: snippet.createdAt,
  updatedAt: snippet.updatedAt,
  topic: snippet.topic,
});

export const createSnippetInDB = async (data: {
  userId: string;
  topicId?: number | null;
  title: string;
  language: string;
  code: string;
  notes?: string;
  tags?: string;
  isPublic?: boolean;
}): Promise<SolutionSnippet> => {
  const snippet = await prisma.solutionSnippet.create({
    data: {
      userId: data.userId,
      topicId: data.topicId ?? null,
      title: data.title,
      language: data.language,
      code: data.code,
      notes: data.notes,
      tags: data.tags,
      isPublic: data.isPublic ?? false,
    },
    include: snippetInclude,
  });
  return toSnippet(snippet);
};

export const getMySnippetsFromDB = async (
  userId: string,
  filter?: { topicId?: number; search?: string },
): Promise<SolutionSnippet[]> => {
  const snippets = await prisma.solutionSnippet.findMany({
    where: {
      userId,
      ...(filter?.topicId ? { topicId: filter.topicId } : {}),
      ...(filter?.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { notes: { contains: filter.search, mode: "insensitive" } },
              { tags: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: snippetInclude,
    orderBy: { createdAt: "desc" },
  });
  return snippets.map(toSnippet);
};

export const getSnippetByIdFromDB = async (id: string): Promise<SolutionSnippet | null> => {
  const snippet = await prisma.solutionSnippet.findUnique({
    where: { id },
    include: snippetInclude,
  });
  return snippet ? toSnippet(snippet) : null;
};

export const getSnippetForUserFromDB = async (
  id: string,
  userId: string,
): Promise<SolutionSnippet | null> => {
  const snippet = await prisma.solutionSnippet.findFirst({
    where: { id, userId },
    include: snippetInclude,
  });
  return snippet ? toSnippet(snippet) : null;
};

export const updateSnippetInDB = async (
  id: string,
  data: {
    topicId?: number | null;
    title?: string;
    language?: string;
    code?: string;
    notes?: string | null;
    tags?: string;
    isPublic?: boolean;
  },
): Promise<SolutionSnippet> => {
  const snippet = await prisma.solutionSnippet.update({
    where: { id },
    data,
    include: snippetInclude,
  });
  return toSnippet(snippet);
};

export const deleteSnippetFromDB = async (id: string) => {
  await prisma.solutionSnippet.delete({ where: { id } });
};
