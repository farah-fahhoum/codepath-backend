import { prisma } from "../lib/prisma";
import axios from "axios";
import { externalAccount } from "../types/externalAccount.type";

const CF_API_BASE = "https://codeforces.com/api";
const CODEFORCES_PLATFORM = "Codeforces";

const accountSelect = {
  id: true,
  platform: true,
  handle: true,
  lastSynced: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const verifyCodeforcesHandleExists = async (
  handle: string,
): Promise<boolean> => {
  const trimmed = handle.trim();
  if (!trimmed) return false;

  try {
    const resp = await axios.get(`${CF_API_BASE}/user.info`, {
      params: { handles: trimmed },
      timeout: 10000,
    });
    return (
      resp.data?.status === "OK" &&
      Array.isArray(resp.data?.result) &&
      resp.data.result.length > 0
    );
  } catch {
    return false;
  }
};

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
  const normalizedPlatform =
    platform.toLowerCase() === "codeforces" ? CODEFORCES_PLATFORM : platform;

  const existing = await prisma.externalAccount.findFirst({
    where: {
      userId,
      platform: { equals: normalizedPlatform, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.externalAccount.update({
      where: { id: existing.id },
      data: {
        handle: handle.trim(),
        platform: normalizedPlatform,
        isVerified: true,
        lastSynced: new Date(),
        updatedAt: new Date(),
      },
      select: accountSelect,
    });
  }

  return prisma.externalAccount.create({
    data: {
      userId,
      platform: normalizedPlatform,
      handle: handle.trim(),
      isVerified: true,
      lastSynced: new Date(),
    },
    select: accountSelect,
  });
};

export const deleteExternalAccountForUser = async (
  userId: string,
  platform: string,
): Promise<boolean> => {
  const normalizedPlatform =
    platform.toLowerCase() === "codeforces" ? CODEFORCES_PLATFORM : platform;

  const existing = await prisma.externalAccount.findFirst({
    where: {
      userId,
      platform: { equals: normalizedPlatform, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (!existing) return false;

  await prisma.externalAccount.delete({ where: { id: existing.id } });
  return true;
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
