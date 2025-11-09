import { Request, Response } from "express";
import {
  addContactInquiryToDB,
  getContactInfoFromDB,
  getContactInquiriesFromDB,
  getContactInquiryFromDB,
  sendEmailToMentees,
  updateContactInfoDB,
} from "../repositories/contact.repo";
import Joi from "joi";

export const getContactInfo = async (req: Request, res: Response) => {
  try {
    const contactInfo = await getContactInfoFromDB(1);
    if (!contactInfo) {
      return res.status(404).json({ message: "Contact info not found" });
    }
    return res.status(200).json(contactInfo);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const updateContactInfo = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      email: Joi.string().email().optional(),
      phone: Joi.string().optional(),
      facebook: Joi.string().optional(),
      instagram: Joi.string().optional(),
      youtube: Joi.string().optional(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { email, phone, facebook, instagram, youtube } = value;
    await updateContactInfoDB(email, phone, facebook, instagram, youtube);
    return res
      .status(200)
      .json({ message: "Contact info updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const getContactInquiries = async (req: Request, res: Response) => {
  try {
    const inquiries = await getContactInquiriesFromDB();
    return res.status(200).json(inquiries);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const getContactInquiry = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.number().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const inquiry = await getContactInquiryFromDB(value.id);
    if (!inquiry) {
      return res.status(404).json({ message: "Invalid inquiry id" });
    }
    return res.status(200).json(inquiry);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const SendContactInquery = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      fullName: Joi.string().required(),
      email: Joi.string().email().required(),
      title: Joi.string().required(),
      message: Joi.string().required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { fullName, email, title, message } = value;
    await addContactInquiryToDB(fullName, email, title, message);
    return res.status(201).json({ message: "Inquiry sent successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const sendMassEmailToMentees = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      emailTitle: Joi.string().required(),
      emailContent: Joi.string().required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { emailTitle, emailContent } = value;
    await sendEmailToMentees(emailTitle, emailContent);
    return res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};
