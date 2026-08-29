import { Request, Response } from "express";
import Joi from "joi";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  createCoachAccountInDB,
  createBookingInDB,
  findBookingByCalEventInDB,
  getBookingByIdFromDB,
  getCoachBookingsFromDB,
  getCoachByIdFromDB,
  getCoachProfileForUserFromDB,
  getCoachesFromDB,
  getMenteeBookingsFromDB,
  updateBookingStatusInDB,
  upsertCoachProfileInDB,
} from "../repositories/coach.repo";
import { checkUserRoleForAuth } from "../repositories/user.repo";
import { prisma } from "../lib/prisma";
import { BookingStatusValue } from "../types/coach.type";

const isAdmin = async (userId: string): Promise<boolean> => {
  const role = await checkUserRoleForAuth(userId);
  return role?.role === "Admin";
};

export const getCoaches = async (req: Request, res: Response) => {
  try {
    const querySchema = Joi.object({
      specialty: Joi.string().optional(),
      available: Joi.boolean().optional(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const coaches = await getCoachesFromDB({
      specialty: value.specialty,
      isAvailable: value.available,
    });
    return res.status(200).json(coaches);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getCoach = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const coach = await getCoachByIdFromDB(value.id);
    if (!coach) return res.status(404).json({ message: "Coach not found" });
    return res.status(200).json(coach);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMyCoachProfile = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const coach = await getCoachProfileForUserFromDB(userId);
    if (!coach) return res.status(404).json({ message: "You are not a coach yet" });
    return res.status(200).json(coach);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const createCoachAccount = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      name: Joi.string().trim().min(1).required(),
      username: Joi.string().min(6).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      country: Joi.string().min(1).required(),
      phone: Joi.string().optional(),
      specialty: Joi.string().trim().min(1).required(),
      bio: Joi.string().optional().allow(""),
      hourlyRate: Joi.number().positive().optional().allow(null),
      isAvailable: Joi.boolean().optional(),
      bookingLink: Joi.string().uri().optional().allow(""),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const password = await bcrypt.hash(value.password, 10);
    const coach = await createCoachAccountInDB({
      ...value,
      password,
    });

    return res.status(201).json({
      message: "Coach account created successfully",
      coach,
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Username or email already in use" });
    }
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const createOrUpdateMyCoachProfile = async (
  req: Request,
  res: Response,
) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const inputSchema = Joi.object({
      name: Joi.string().trim().min(1).required(),
      specialty: Joi.string().min(1).required(),
      bio: Joi.string().optional().allow(""),
      hourlyRate: Joi.number().positive().optional().allow(null),
      isAvailable: Joi.boolean().optional(),
      bookingLink: Joi.string().uri().optional().allow(""),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const coach = await upsertCoachProfileInDB(userId, {
      name: value.name,
      specialty: value.specialty,
      bio: value.bio,
      hourlyRate: value.hourlyRate,
      isAvailable: value.isAvailable,
      bookingLink: value.bookingLink,
    });

    return res.status(200).json({
      message: "Coach profile saved",
      coach,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value: params, error: paramError } = paramSchema.validate(req.params);
    if (paramError) return res.status(400).json({ message: paramError.message });

    const bodySchema = Joi.object({
      startTime: Joi.date().iso().required(),
      endTime: Joi.date().iso().required(),
      notes: Joi.string().optional().allow(""),
    });
    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (startTime >= endTime) {
      return res.status(400).json({ message: "startTime must be before endTime" });
    }
    if (startTime.getTime() <= Date.now()) {
      return res.status(400).json({ message: "Booking must start in the future" });
    }

    const coach = await getCoachByIdFromDB(params.id);
    if (!coach) return res.status(404).json({ message: "Coach not found" });
    if (!coach.isAvailable) {
      return res.status(400).json({ message: "Coach is not available for bookings" });
    }

    // Conflict check with the coach's existing bookings.
    const conflict = await prisma.booking.findFirst({
      where: {
        coachId: coach.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } },
        ],
      },
    });
    if (conflict) {
      return res.status(409).json({ message: "Coach is already booked for this time slot" });
    }

    const booking = await createBookingInDB({
      coachId: coach.id,
      menteeId: userId,
      startTime,
      endTime,
      notes: body.notes,
    });

    return res.status(201).json({
      message: "Booking request created",
      booking,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMyBookings = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const bookings = await getMenteeBookingsFromDB(userId);
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getCoachBookings = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const coach = await getCoachProfileForUserFromDB(userId);
    if (!coach) return res.status(404).json({ message: "You are not a coach yet" });

    const bookings = await getCoachBookingsFromDB(coach.id);
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value: params, error: paramError } = paramSchema.validate(req.params);
    if (paramError) return res.status(400).json({ message: paramError.message });

    const bodySchema = Joi.object({
      status: Joi.string().valid("PENDING", "CONFIRMED", "COMPLETED", "CANCELLED").required(),
      meetingUrl: Joi.string().optional().allow(""),
    });
    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const booking = await getBookingByIdFromDB(params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const coach = await getCoachProfileForUserFromDB(userId);
    const canManage =
      (coach && coach.id === booking.coachId) ||
      (await isAdmin(userId)) ||
      (booking.menteeId === userId && body.status === "CANCELLED");

    if (!canManage) {
      return res.status(403).json({ message: "Not authorized to update this booking" });
    }

    const updated = await updateBookingStatusInDB(
      params.id,
      body.status as BookingStatusValue,
      { meetingUrl: body.meetingUrl },
    );

    return res.status(200).json({
      message: "Booking updated",
      booking: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

const calWebhook = async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody as string | undefined;
    if (!rawBody) {
      return res.status(400).json({ message: "Missing raw body" });
    }

    const signature = req.headers["x-cal-signature"] as string | undefined;
    if (!signature) {
      return res.status(401).json({ message: "Missing signature" });
    }

    const secret = process.env.CAL_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "CAL_WEBHOOK_SECRET is not configured" });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const received = Buffer.from(String(signature), "utf-8");
    const expectedBuffer = Buffer.from(expected, "utf-8");
    if (received.length !== expectedBuffer.length || !crypto.timingSafeEqual(received, expectedBuffer)) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const event = req.body as any;
    const trigger = event?.triggerEvent || event?.type;
    const payload = event?.payload || event?.data || {};

    const uid = payload?.uid || payload?.booking?.uid;
    const startTime = payload?.startTime || payload?.booking?.startTime;
    const endTime = payload?.endTime || payload?.booking?.endTime;

    if (trigger?.toUpperCase().includes("CANCELLED") || trigger === "BOOKING_CANCELLED") {
      if (uid) {
        const existing = await findBookingByCalEventInDB(uid);
        if (existing) {
          await updateBookingStatusInDB(existing.id, "CANCELLED");
        }
      }
      return res.status(200).json({ message: "ok" });
    }

    if (trigger?.toUpperCase().includes("RESCHEDULED") || trigger === "BOOKING_RESCHEDULED") {
      if (uid) {
        const existing = await findBookingByCalEventInDB(uid);
        if (existing && startTime && endTime) {
          await prisma.booking.update({
            where: { id: existing.id },
            data: { startTime: new Date(startTime), endTime: new Date(endTime), status: "CONFIRMED" },
          });
        }
      }
      return res.status(200).json({ message: "ok" });
    }

    // booking.created / booking.requested
    if (!uid || !startTime || !endTime) {
      return res.status(200).json({ message: "ignored" });
    }

    const existing = await findBookingByCalEventInDB(uid);
    if (existing) {
      await updateBookingStatusInDB(existing.id, "CONFIRMED");
      return res.status(200).json({ message: "ok" });
    }

    const organizerEmail = payload?.organizer?.email;
    const attendeeEmail = payload?.attendees?.[0]?.email;

    const organizer = organizerEmail
      ? await prisma.user.findFirst({ where: { email: organizerEmail }, select: { id: true } })
      : null;
    const coach = organizer
      ? await prisma.coach.findUnique({ where: { userId: organizer.id }, select: { id: true } })
      : null;

    const attendee = attendeeEmail
      ? await prisma.user.findFirst({ where: { email: attendeeEmail }, select: { id: true } })
      : null;

    if (!coach || !attendee) {
      // Cannot link the booking without a known coach + mentee user.
      return res.status(200).json({ message: "ignored" });
    }

    await createBookingInDB({
      coachId: coach.id,
      menteeId: attendee.id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      calEventUid: uid,
    });

    return res.status(201).json({ message: "ok" });
  } catch (error) {
    return res.status(500).json({ message: "Webhook error", error });
  }
};

export { calWebhook };
