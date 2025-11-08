import { PrismaClient } from "@prisma/client";
import {
  contactInfoType,
  contactInquiryDetails,
  contactInquirySafe,
} from "../types/contact.type";
const prisma = new PrismaClient();

export const getContactInfoFromDB = async (
  id: number
): Promise<contactInfoType | null> => {
  const contactInfoRecord = await prisma.contactInfo.findFirst({
    where: { id },
    select: {
      id: true,
      email: true,
      phone: true,
      facebook: true,
      instagram: true,
      youtube: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return contactInfoRecord ?? null;
};

export const updateContactInfoDB = async (
  email: string,
  phone: string,
  facebook: string,
  instagram: string,
  youtube: string
) => {
  await prisma.contactInfo.update({
    where: { id: 1 },
    data: { email, phone, facebook, instagram, youtube },
  });
};

export const getContactInquiriesFromDB = async (): Promise<
  contactInquirySafe[]
> => {
  const contactInquiryRecords = await prisma.contactInquery.findMany({
    select: { id: true, fullName: true, title: true, createdAt: true },
  });
  return contactInquiryRecords;
};

export const getContactInquiryFromDB = async (
  id: number
): Promise<contactInquiryDetails | null> => {
  const contactInquiryRecord = await prisma.contactInquery.findFirst({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      title: true,
      message: true,
      createdAt: true,
    },
  });
  return contactInquiryRecord ?? null;
};

export const addContactInquiryToDB = async (
  fullName: string,
  email: string,
  title: string,
  message: string
) => {
  await prisma.contactInquery.create({
    data: { fullName, email, title, message },
  });
};
