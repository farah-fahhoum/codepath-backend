import { prisma } from "../lib/prisma";
import { externalAccount } from "../types/externalAccount.type";

const accountSelect = {
  id: true,
  platform: true,
  handle: true,
  lastSynced: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const getExternalAccountIntegrationFromDB = async (
  userId: string,
): Promise<externalAccount | null> => {
  return prisma.externalAccount.findFirst({
    where: {
      userId,
      platform: { equals: "Codeforces", mode: "insensitive" },
    },
    select: accountSelect,
  });
};

/** Get Codeforces handle for user when linked (for stats from CF API). */
export const getCodeforcesHandleForUser = async (
  userId: string,
): Promise<string | null> => {
  const account = await prisma.externalAccount.findFirst({
    where: {
      userId,
      platform: { equals: "Codeforces", mode: "insensitive" },
    },
    select: { handle: true },
  });
  return account?.handle ?? null;
};

/** Link (or re-link) the user's Codeforces handle without creating duplicates. */
export const upsertExternalAccount = async (
  userId: string,
  platform: string,
  handle: string,
): Promise<externalAccount> => {
  const existing = await prisma.externalAccount.findFirst({
    where: { userId, platform },
    select: { id: true },
  });

  if (existing) {
    return prisma.externalAccount.update({
      where: { id: existing.id },
      data: { handle, isVerified: false, updatedAt: new Date() },
      select: accountSelect,
    });
  }

  return prisma.externalAccount.create({
    data: {
      userId,
      platform,
      handle,
      isVerified: false,
    },
    select: accountSelect,
  });
};

export const createExternalAccount = async (
  userId: string,
  platform: string,
  handle: string,
): Promise<externalAccount> => {
  return prisma.externalAccount.create({
    data: {
      userId,
      platform,
      handle,
      isVerified: false,
    },
    select: {
      id: true,
      platform: true,
      handle: true,
      lastSynced: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};
