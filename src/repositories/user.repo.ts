import { prisma } from "../lib/prisma";
import {
  adminSafe,
  menteeDetails,
  menteeProfile,
  menteeSafe,
  role,
  userRoleForAuthType,
} from "../types/user.type";
import { NearbyMentee } from "../types/nearby.type";

// Shared Prisma client

export const checkUserRoleForAuth = async (
  id: string,
): Promise<userRoleForAuthType | null> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      role: true,
    },
  });
  if (user) {
    return { role: user.role.title };
  } else return null;
};

export const getUserByEmailForAuth = async (
  email: string,
): Promise<{
  id: string;
  email: string;
  password: string;
  role: { id: number; title: string };
} | null> => {
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, password: true, role: true },
  });
  return user ?? null;
};

export const getUserByIdWithPassword = async (
  id: string,
): Promise<{ id: string; password: string } | null> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, password: true },
  });
  return user ?? null;
};

export const updateUserPasswordInDB = async (
  id: string,
  newHashedPassword: string,
): Promise<void> => {
  await prisma.user.update({
    where: { id },
    data: { password: newHashedPassword },
  });
};

export const checkIfEmailExist = async (email: string): Promise<boolean> => {
  const recordExist = await prisma.user.count({ where: { email } });
  if (recordExist > 0) return true;
  else return false;
};

export const checkIfUsernameExist = async (
  username: string,
): Promise<boolean> => {
  const recordExist = await prisma.user.count({ where: { username } });
  if (recordExist > 0) return true;
  else return false;
};

export const checkIfAdminRoleIdValid = async (
  roleId: number,
): Promise<boolean> => {
  const recordExist = await prisma.role.count({
    where: { id: roleId, title: "Admin" },
  });
  if (recordExist > 0) return true;
  else return false;
};

export const checkIfMenteeRoleIdValid = async (
  roleId: number,
): Promise<boolean> => {
  const recordExist = await prisma.role.count({
    where: { id: roleId, title: "Mentee" },
  });
  if (recordExist > 0) return true;
  else return false;
};

export const getMenteeRoleId = async (): Promise<number> => {
  const menteeRole = await prisma.role.findFirst({
    where: { title: "Mentee" },
  });
  if (!menteeRole) throw new Error("Mentee role not found");
  return menteeRole.id;
};

export const addAdminToDB = async (
  email: string,
  username: string,
  password: string,
  roleId: number,
) => {
  await prisma.user.create({ data: { email, username, password, roleId } });
};

export const addMenteeToDB = async (
  email: string,
  fullName: string,
  username: string,
  password: string,
  roleId: number,
  country: string,
  phone?: string,
  bio?: string,
): Promise<string> => {
  const userAdded = await prisma.user.create({
    data: { username, email, password, roleId },
  });
  await prisma.profile.create({
    data: {
      userId: userAdded.id,
      fullName,
      country,
      phone,
      bio,
    },
  });
  return userAdded.id;
};

export const getAdminsFromDB = async (): Promise<adminSafe[]> => {
  const adminRoleId = await prisma.role.findFirst({
    where: { title: "Admin" },
    select: { id: true },
  });
  const adminRecords = await prisma.user.findMany({
    where: { roleId: adminRoleId.id },
    select: { id: true, username: true, email: true, createdAt: true },
  });
  return adminRecords;
};

export const getAdminByIdFromDB = async (
  id: string,
): Promise<adminSafe | null> => {
  const adminRecord = await prisma.user.findFirst({
    where: { id },
    select: { id: true, username: true, email: true, createdAt: true },
  });
  if (!adminRecord) return null;
  else return adminRecord;
};

export const deleteAdminFromDB = async (id: string): Promise<number> => {
  const recordsAffected = await prisma.user.delete({ where: { id } });
  if (recordsAffected) return 1;
  else return 0;
};

export const updateAdminInDB = async (
  id: string,
  data: { username?: string; email?: string; password?: string },
): Promise<adminSafe | null> => {
  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, email: true, createdAt: true },
  });
  return updated ?? null;
};

export const getMenteesFromDB = async (
  fullName?: string,
  email?: string,
  level?: string,
  username?: string,
): Promise<menteeSafe[]> => {
  const menteeRoleId = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });
  if (!menteeRoleId) return [];

  const query: Record<string, unknown> = { roleId: menteeRoleId.id };
  if (fullName) {
    query.profile = {
      is: { fullName: { contains: fullName, mode: "insensitive" } },
    };
  }
  if (email) query.email = { contains: email, mode: "insensitive" };
  if (username) query.username = { contains: username, mode: "insensitive" };

  const menteeRecords = await prisma.user.findMany({
    where: query,
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      profile: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const menteesWithLevels = await Promise.all(
    menteeRecords.map(async (mentee) => {
      const snapshot = await prisma.userSkillSnapshot.findUnique({
        where: { userId: mentee.id },
        select: { tier: true },
      });

      return {
        id: mentee.id,
        username: mentee.username,
        email: mentee.email,
        fullName: mentee.profile?.fullName ?? null,
        level: snapshot?.tier ?? null,
        createdAt: mentee.createdAt,
      };
    }),
  );

  if (level) {
    const normalizedLevel = level.toLowerCase();
    return menteesWithLevels.filter(
      (mentee) => mentee.level?.toLowerCase() === normalizedLevel,
    );
  }

  return menteesWithLevels;
};

export const getMenteeByIdFromDB = async (
  id: string,
): Promise<menteeDetails | null> => {
  const menteeRecord = await prisma.user.findFirst({
    where: { id },
    select: { id: true, username: true, email: true, createdAt: true },
  });

  const menteeProfileRecord = await prisma.profile.findFirst({
    where: { userId: id },
    select: {
      id: true,
      fullName: true,
      phone: true,
      country: true,
      bio: true,
      createdAt: true,
    },
  });

  const snapshot = await prisma.userSkillSnapshot.findUnique({
    where: { userId: id },
    select: { tier: true },
  });

  const codeforcesAccount = await prisma.externalAccount.findFirst({
    where: { userId: id, platform: "Codeforces" },
    select: { handle: true },
  });

  if (!menteeRecord) return null;

  return {
    id: menteeRecord.id,
    email: menteeRecord.email,
    username: menteeRecord.username,
    fullName: menteeProfileRecord?.fullName ?? "",
    phone: menteeProfileRecord?.phone ?? "",
    country: menteeProfileRecord?.country ?? "",
    bio: menteeProfileRecord?.bio ?? "",
    level: snapshot?.tier ?? null,
    codeforcesHandle: codeforcesAccount?.handle ?? null,
    createdAt: menteeRecord.createdAt,
  };
};

export const getRolesFromDB = async (): Promise<role[]> => {
  const roles = await prisma.role.findMany({
    select: { id: true, title: true, createdAt: true },
  });
  return roles;
};

export const getRoleFromDB = async (id: number): Promise<role | null> => {
  const role = await prisma.role.findFirst({
    where: { id },
    select: { id: true, title: true, createdAt: true },
  });
  return role ?? null;
};

export const getMenteeProfileFromDB = async (
  userId: string,
): Promise<menteeProfile | null> => {
  const menteeRecord = await prisma.user.findFirst({
    where: { id: userId },
    select: { id: true, username: true, email: true, createdAt: true },
  });
  const menteeProfileRecord = await prisma.profile.findFirst({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      country: true,
      bio: true,
      createdAt: true,
    },
  });
  if (!menteeRecord || !menteeProfileRecord) return null;
  else
    return {
      id: menteeRecord.id,
      fullName: menteeProfileRecord.fullName,
      username: menteeRecord.username,
      email: menteeRecord.email,
      phone: menteeProfileRecord.phone,
      country: menteeProfileRecord.country,
      bio: menteeProfileRecord.bio,
      createdAt: menteeRecord.createdAt,
    };
};

export const updateMenteeProfileInDB = async (
  userId: string,
  data: { fullName?: string; phone?: string; country?: string; bio?: string },
): Promise<void> => {
  await prisma.profile.updateMany({
    where: { userId },
    data: {
      ...(data.fullName != null && { fullName: data.fullName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.country != null && { country: data.country }),
      ...(data.bio !== undefined && { bio: data.bio }),
    },
  });
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const buildProximityLabel = (
  me: { city: string | null; country: string | null },
  profile: { city: string | null; country: string | null },
  similarityScore: number,
): string => {
  if (
    me.city &&
    profile.city &&
    me.city.toLowerCase() === profile.city.toLowerCase()
  ) {
    const km = Math.max(0.5, (100 - similarityScore) / 25).toFixed(1);
    return `${km} km away`;
  }
  if (profile.city) return profile.city;
  if (profile.country) return profile.country;
  return `${Math.round(similarityScore)}% match`;
};

/**
 * Recommend mentees similar to the current user by rating, accuracy,
 * problems-solved and geography. The returned list is sorted by similarity.
 */
export const getNearbyMenteesFromDB = async (
  userId: string,
  options?: {
    country?: string;
    city?: string;
    minRating?: number;
    maxRating?: number;
    limit?: number;
  },
): Promise<NearbyMentee[]> => {
  const menteeRole = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });
  if (!menteeRole) return [];

  const me = await prisma.profile.findUnique({
    where: { userId },
    select: { rating: true, accuracy: true, problemsSolved: true, country: true, city: true },
  });
  if (!me) return [];

  const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;

  const users = await prisma.user.findMany({
    where: {
      roleId: menteeRole.id,
      id: { not: userId },
      profile: { isNot: null },
    },
    select: {
      id: true,
      username: true,
      profile: {
        select: {
          fullName: true,
          country: true,
          city: true,
          organization: true,
          rating: true,
          accuracy: true,
          problemsSolved: true,
        },
      },
      skillSnapshot: {
        select: { tier: true, rating: true, confidence: true },
      },
    },
  });

  const codeforcesAccounts = await prisma.externalAccount.findMany({
    where: {
      platform: "Codeforces",
      userId: { in: users.map((user) => user.id) },
    },
    select: { userId: true, handle: true },
  });
  const codeforcesHandleByUserId = new Map(
    codeforcesAccounts.map((account) => [account.userId, account.handle]),
  );

  const matches: NearbyMentee[] = [];

  for (const user of users) {
    const profile = user.profile;
    if (!profile) continue;

    if (
      options?.country &&
      profile.country?.toLowerCase() !== options.country.toLowerCase()
    ) {
      continue;
    }
    if (
      options?.city &&
      profile.city?.toLowerCase() !== options.city.toLowerCase()
    ) {
      continue;
    }
    const profileRating = profile.rating ?? 0;
    if (options?.minRating != null && profileRating < options.minRating) {
      continue;
    }
    if (options?.maxRating != null && profileRating > options.maxRating) {
      continue;
    }

    const rating = profileRating;
    const accuracy = profile.accuracy ?? 0;
    const problemsSolved = profile.problemsSolved ?? 0;

    // Normalised proximity features in [0, 1].
    const ratingProximity =
      rating > 0
        ? clamp(1 - Math.abs(rating - (me.rating ?? 0)) / 2000, 0, 1)
        : 0;
    const accuracyProximity =
      accuracy > 0
        ? clamp(1 - Math.abs(accuracy - (me.accuracy ?? 0)) / 100, 0, 1)
        : 0.5;
    const solvedProximity =
      problemsSolved > 0 && (me.problemsSolved ?? 0) > 0
        ? clamp(1 - Math.abs(Math.log10(problemsSolved + 1) - Math.log10((me.problemsSolved ?? 0) + 1)) / 4, 0, 1)
        : 0.5;

    let geoBonus = 0;
    if (me.city && profile.city && me.city.toLowerCase() === profile.city.toLowerCase()) {
      geoBonus += 0.2;
    }
    if (me.country && profile.country && me.country.toLowerCase() === profile.country.toLowerCase()) {
      geoBonus += 0.1;
    }
    if (me.city && profile.organization) {
      geoBonus += 0.05;
    }

    const similarityScore = Math.round(
      clamp(
        40 * ratingProximity +
          20 * accuracyProximity +
          20 * solvedProximity +
          20 * geoBonus,
        0,
        100,
      ) * 100,
    ) / 100;

    matches.push({
      userId: user.id,
      username: user.username,
      fullName: profile.fullName ?? null,
      country: profile.country ?? null,
      city: profile.city ?? null,
      organization: profile.organization ?? null,
      rating: profile.rating,
      accuracy: profile.accuracy,
      problemsSolved: profile.problemsSolved,
      level: user.skillSnapshot?.tier ?? null,
      similarityScore,
      proximityLabel: buildProximityLabel(me, profile, similarityScore),
      codeforcesHandle: codeforcesHandleByUserId.get(user.id) ?? null,
    });
  }

  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  return matches.slice(0, limit);
};
