import { prisma } from "../lib/prisma";

export type InsightRecord = {
  id: number;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function getActiveInsightsFromDB(): Promise<InsightRecord[]> {
  return prisma.insight.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getAllInsightsFromDB(): Promise<InsightRecord[]> {
  return prisma.insight.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getInsightByIdFromDB(
  id: number,
): Promise<InsightRecord | null> {
  return prisma.insight.findUnique({ where: { id } });
}

export async function createInsightInDB(data: {
  content: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<InsightRecord> {
  return prisma.insight.create({
    data: {
      content: data.content,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateInsightInDB(
  id: number,
  data: {
    content?: string;
    isActive?: boolean;
    sortOrder?: number;
  },
): Promise<InsightRecord | null> {
  try {
    return await prisma.insight.update({
      where: { id },
      data,
    });
  } catch {
    return null;
  }
}

export async function deleteInsightFromDB(id: number): Promise<boolean> {
  try {
    await prisma.insight.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
