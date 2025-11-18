import { PrismaClient } from "@prisma/client";
import {
  adminSafe,
  menteeDetails,
  menteeSafe,
  role,
  userRoleForAuthType,
} from "../types/user.type";

const prisma = new PrismaClient();

export const checkUserRoleForAuth = async (
  id: string
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
  email: string
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

export const checkIfEmailExist = async (email: string): Promise<boolean> => {
  const recordExist = await prisma.user.count({ where: { email } });
  if (recordExist > 0) return true;
  else return false;
};

export const checkIfUsernameExist = async (
  username: string
): Promise<boolean> => {
  const recordExist = await prisma.user.count({ where: { username } });
  if (recordExist > 0) return true;
  else return false;
};

export const checkIfAdminRoleIdValid = async (
  roleId: number
): Promise<boolean> => {
  const recordExist = await prisma.role.count({
    where: { id: roleId, title: "Admin" },
  });
  if (recordExist > 0) return true;
  else return false;
};

export const checkIfMenteeRoleIdValid = async (
  roleId: number
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
  roleId: number
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
  bio?: string
) => {
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
  id: string
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
  data: { username?: string; email?: string; password?: string }
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
  level?: string
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

  //Get mentees levels
  return menteeRecords;
};

export const getMenteeByIdFromDB = async (
  id: string
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

  //Get mentee level & CF handle

  let result: menteeDetails = {
    id: menteeRecord.id,
    email: menteeRecord.email,
    username: menteeRecord.username,
    fullName: menteeProfileRecord.fullName,
    phone: menteeProfileRecord.phone,
    country: menteeProfileRecord.country,
    bio: menteeProfileRecord.bio,
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
