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
