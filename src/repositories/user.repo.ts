import { prisma } from "../lib/prisma";
import {
  adminSafe,
  menteeDetails,
  menteeProfile,
  menteeSafe,
  role,
  userRoleForAuthType,
} from "../types/user.type";

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
): Promise<menteeSafe[]> => {
  const menteeRoleId = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });

  //Create query object
  const query: any = { roleId: menteeRoleId.id };
  // Filter by Profile.fullName (not User.username)
  if (fullName)
    query.profile = {
      is: { fullName: { contains: fullName, mode: "insensitive" } },
    };
  if (email) query.email = { contains: email };

  const menteeRecords = await prisma.user.findMany({
    where: query,
    select: { id: true, username: true, email: true, createdAt: true },
  });

  // Get mentees levels
  const menteesWithLevels = await Promise.all(
    menteeRecords.map(async (mentee) => {
      // Get the latest skill assessment for this mentee
      const latestAssessment = await prisma.userSkillAssessment.findFirst({
        where: { userId: mentee.id },
        orderBy: { createdAt: "desc" },
        include: {
          skillLevel: {
            select: { title: true },
          },
        },
      });

      return {
        ...mentee,
        level: latestAssessment?.skillLevel?.title || null,
      };
    }),
  );

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

  // Get mentee level
  const latestAssessment = await prisma.userSkillAssessment.findFirst({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    include: {
      skillLevel: {
        select: { title: true },
      },
    },
  });

  let result: menteeDetails = {
    id: menteeRecord.id,
    email: menteeRecord.email,
    username: menteeRecord.username,
    fullName: menteeProfileRecord.fullName,
    phone: menteeProfileRecord.phone,
    country: menteeProfileRecord.country,
    bio: menteeProfileRecord.bio,
    level: latestAssessment?.skillLevel?.title || null,
    createdAt: menteeRecord.createdAt,
  };
  if (!menteeRecord) return null;
  else return result;
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
