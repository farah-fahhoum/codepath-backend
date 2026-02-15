import { prisma } from "../lib/prisma";
import { externalAccount } from "../types/externalAccount.type";

export const getExternalAccountIntegrationFromDB = async (
  userId: string,
): Promise<externalAccount | null> => {
  return prisma.externalAccount.findFirst({
    where: { userId },
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

/** Get Codeforces handle for user when linked (for stats from CF API). */
export const getCodeforcesHandleForUser = async (
  userId: string,
): Promise<string | null> => {
  const account = await prisma.externalAccount.findFirst({
    where: { userId, platform: "Codeforces" },
    select: { handle: true },
  });
  return account?.handle ?? null;
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
