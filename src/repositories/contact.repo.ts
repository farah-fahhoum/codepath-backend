import { PrismaClient } from "@prisma/client";
import * as nodemailer from "nodemailer";
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

export const sendEmailToMentees = async (
  emailTitle: string,
  emailContent: string
) => {
  // Fetch all mentee emails
  const menteeRole = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });

  if (!menteeRole) {
    throw new Error("Mentee role not found");
  }

  const mentees = await prisma.user.findMany({
    where: { roleId: menteeRole.id },
    select: { email: true },
  });

  const recipientEmails = mentees.map((m) => m.email).filter(Boolean);
  if (recipientEmails.length === 0) {
    // No recipients; nothing to send
    return;
  }

  const sender = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
    connectionTimeout: 60000, // 60 seconds connection timeout
    socketTimeout: 60000, // 60 seconds socket timeout
  });

  try {
    await sender.sendMail({
      from: `"CodePath Platform" <${process.env.EMAIL_ADDRESS}>`,
      // Use BCC to avoid exposing recipients to each other
      to: process.env.EMAIL_ADDRESS || "undisclosed-recipients@no-reply.local",
      bcc: recipientEmails,
      subject: emailTitle,
      text: emailContent,
    });
  } catch (error) {
    throw error;
  }
};
