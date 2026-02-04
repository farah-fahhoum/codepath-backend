import { Request, Response } from "express";
import Joi from "joi";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  addAdminToDB,
  addMenteeToDB,
  checkIfAdminRoleIdValid,
  checkIfEmailExist,
  checkIfUsernameExist,
  deleteAdminFromDB,
  getAdminByIdFromDB,
  getAdminsFromDB,
  getMenteeByIdFromDB,
  getMenteeProfileFromDB,
  getMenteesFromDB,
  getMenteeRoleId,
  getRoleFromDB,
  getRolesFromDB,
  getUserByEmailForAuth,
  getUserByIdWithPassword,
  updateAdminInDB,
  updateUserPasswordInDB,
} from "../repositories/user.repo";
import { getExternalAccountIntegrationFromDB } from "../repositories/externalAccount.repo";
import {
  getMenteeCodePathLevel,
  getMenteeProblemsSolvedCount,
} from "../repositories/statistics.repo";

export const adminAndMenteeLogin = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    //Match user data provided with stored data in DB
    const user = await getUserByEmailForAuth(value.email);
    if (!user) return res.status(401).json({ message: "Invalid Credentials" });

    //Check if password provided matches password stored in DB
    const passwordMatch = await bcrypt.compare(value.password, user.password);
    if (!passwordMatch)
      return res.status(401).json({ message: "Invalid Credentials" });

    const accessToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      message: "Logged in successfully",
      accessToken,
      user: { id: user.id, email: user.email, role: user.role.title },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const menteeRegister = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      fullName: Joi.string().min(6).required(),
      username: Joi.string().min(6).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      phone: Joi.string().optional(),
      country: Joi.string().required(),
      bio: Joi.string().optional(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const { fullName, username, email, password, phone, country, bio } = value;

    //Check if email already in use before proceeding
    const emailExist = await checkIfEmailExist(email);
    if (emailExist)
      return res.status(401).json({ message: "Email already in use" });

    //Check if username already in use before proceeding
    const usernameExist = await checkIfUsernameExist(username);
    if (usernameExist)
      return res.status(401).json({ message: "Username already in use" });

    // Get Mentee role id from DB (no need for client to send it)
    const roleId = await getMenteeRoleId();

    //Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await addMenteeToDB(
      email,
      fullName,
      username,
      hashedPassword,
      roleId,
      country,
      phone,
      bio,
    );

    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    return res.status(201).json({
      message: "Mentee added successfully",
      accessToken,
      user: { id: userId, email, role: "Mentee" },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getMentees = async (req: Request, res: Response) => {
  try {
    const querySchema = Joi.object({
      name: Joi.string().min(1).optional(),
      email: Joi.string().email().optional(),
      level: Joi.string().min(1).optional(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const { name, email, level } = value;

    const mentees = await getMenteesFromDB(name, email, level);
    return res.status(200).json(mentees);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getMentee = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const mentee = await getMenteeByIdFromDB(value.id);
    if (mentee) return res.status(200).json(mentee);
    else return res.status(404).json({ message: "Invalid mentee id" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getAdmins = async (req: Request, res: Response) => {
  try {
    const admins = await getAdminsFromDB();
    return res.status(200).json(admins);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getAdmin = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const admin = await getAdminByIdFromDB(value.id);
    if (admin) return res.status(200).json(admin);
    else return res.status(404).json({ message: "Invalid admin id" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const createAdmin = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      username: Joi.string().min(6).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      roleId: Joi.number().min(1).required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { username, email, password, roleId } = value;

    //Check if email already in use before proceeding
    const emailExist = await checkIfEmailExist(email);
    if (emailExist)
      return res.status(401).json({ message: "Email already in use" });

    //Check if username already in use before proceeding
    const usernameExist = await checkIfUsernameExist(username);
    if (usernameExist)
      return res.status(401).json({ message: "Username already in use" });

    //Check if role id is valid
    const validRole = await checkIfAdminRoleIdValid(roleId);
    if (!validRole) return res.status(401).json({ message: "Invalid role id" });

    //Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    await addAdminToDB(email, username, hashedPassword, roleId);
    return res.status(201).json({ message: "Admin added succesfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const updateAdmin = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const bodySchema = Joi.object({
      username: Joi.string().min(6),
      email: Joi.string().email(),
      password: Joi.string().min(8),
    }).min(1);

    const { value: params, error: paramError } = paramSchema.validate(
      req.params,
    );
    if (paramError)
      return res.status(400).json({ message: paramError.message });

    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    // Only allow the logged-in admin to update their own record
    const userIdFromToken = (req as any).user?.id;
    if (!userIdFromToken)
      return res.status(401).json({ message: "Provide a token" });
    if (userIdFromToken !== params.id)
      return res.status(403).json({ message: "Forbidden" });

    // Hash password if provided
    let updateData: { username?: string; email?: string; password?: string } =
      {};
    if (body.username) updateData.username = body.username;
    if (body.email) updateData.email = body.email;
    if (body.password)
      updateData.password = await bcrypt.hash(body.password, 10);

    const updated = await updateAdminInDB(params.id, updateData);
    return res
      .status(200)
      .json({ message: "Admin updated successfully", admin: updated });
  } catch (error: any) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const adminAffected = await deleteAdminFromDB(value.id);
    //Check number of affected rows in DB after deletion
    if (adminAffected > 0)
      return res.status(200).json({ message: "Admin deleted succesfully" });
    else return res.status(404).json({ message: "Invalid admin id" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getRoles = async (req: Request, res: Response) => {
  try {
    const roles = await getRolesFromDB();
    return res.status(200).json(roles);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getRole = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.number().min(1).required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const role = await getRoleFromDB(value.id);
    if (role) return res.status(200).json(role);
    else return res.status(404).json({ message: "Invalid role id" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getMenteeProfile = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const mentee = await getMenteeProfileFromDB(userId);
    const externalAccountIntegration =
      await getExternalAccountIntegrationFromDB(userId);
    const problemsSolved = await getMenteeProblemsSolvedCount(userId);
    const quizResult = await getMenteeCodePathLevel(userId);
    if (!mentee) return res.status(404).json({ message: "Invalid mentee id" });
    else
      return res.status(200).json({
        mentee,
        externalAccountIntegration,
        statistics: { problemsSolved, quizResult },
      });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const updateMenteePassword = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).required(),
      confirmNewPassword: Joi.string().valid(Joi.ref("newPassword")).required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await getUserByIdWithPassword(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const matches = await bcrypt.compare(value.currentPassword, user.password);
    if (!matches)
      return res.status(401).json({ message: "Incorrect current password" });

    const hashed = await bcrypt.hash(value.newPassword, 10);
    await updateUserPasswordInDB(userId, hashed);
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};
