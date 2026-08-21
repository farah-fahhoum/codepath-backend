import { prisma } from "../lib/prisma";
import { BookingStatusValue } from "../types/coach.type";
import { BookingSummary, CoachProfile } from "../types/coach.type";

const coachInclude = {
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      profile: { select: { fullName: true, country: true } },
    },
  },
} as const;

const toCoachProfile = (coach: any): CoachProfile => ({
  id: coach.id,
  specialty: coach.specialty,
  bio: coach.bio,
  hourlyRate: coach.hourlyRate != null ? String(coach.hourlyRate) : null,
  isAvailable: coach.isAvailable,
  bookingLink: coach.bookingLink,
  user: coach.user,
});

export const getCoachesFromDB = async (filter?: {
  specialty?: string;
  isAvailable?: boolean;
}): Promise<CoachProfile[]> => {
  const coaches = await prisma.coach.findMany({
    where: {
      ...(filter?.specialty ? { specialty: { contains: filter.specialty, mode: "insensitive" } } : {}),
      ...(filter?.isAvailable != null ? { isAvailable: filter.isAvailable } : {}),
    },
    include: coachInclude,
    orderBy: { createdAt: "asc" },
  });

  return coaches.map(toCoachProfile);
};

export const getCoachByIdFromDB = async (id: string): Promise<CoachProfile | null> => {
  const coach = await prisma.coach.findUnique({
    where: { id },
    include: coachInclude,
  });
  return coach ? toCoachProfile(coach) : null;
};

export const getCoachProfileForUserFromDB = async (
  userId: string,
): Promise<CoachProfile | null> => {
  const coach = await prisma.coach.findUnique({
    where: { userId },
    include: coachInclude,
  });
  return coach ? toCoachProfile(coach) : null;
};

export const upsertCoachProfileInDB = async (
  userId: string,
  data: {
    specialty: string;
    bio?: string;
    hourlyRate?: number | null;
    isAvailable?: boolean;
    bookingLink?: string;
  },
) => {
  const coach = await prisma.coach.upsert({
    where: { userId },
    update: {
      ...(data.specialty ? { specialty: data.specialty } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.hourlyRate !== undefined ? { hourlyRate: data.hourlyRate } : {}),
      ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable } : {}),
      ...(data.bookingLink !== undefined ? { bookingLink: data.bookingLink } : {}),
    },
    create: {
      userId,
      specialty: data.specialty,
      bio: data.bio,
      hourlyRate: data.hourlyRate,
      isAvailable: data.isAvailable ?? true,
      bookingLink: data.bookingLink,
    },
    include: coachInclude,
  });
  return toCoachProfile(coach);
};

export const createBookingInDB = async (data: {
  coachId: string;
  menteeId: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
  calEventUid?: string;
}) => {
  return prisma.booking.create({ data });
};

export const getBookingByIdFromDB = async (id: string) => {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      coach: {
        include: {
          user: { select: { id: true, username: true, email: true, profile: { select: { fullName: true } } } },
        },
      },
      mentee: { select: { id: true, username: true, email: true, profile: { select: { fullName: true } } } },
    },
  });
};

export const getMenteeBookingsFromDB = async (menteeId: string): Promise<BookingSummary[]> => {
  const bookings = await prisma.booking.findMany({
    where: { menteeId },
    include: {
      coach: { include: { user: { select: { profile: { select: { fullName: true } } } } } },
    },
    orderBy: { startTime: "asc" },
  });

  return bookings.map((booking: any): BookingSummary => ({
    id: booking.id,
    coachId: booking.coachId,
    coachName: booking.coach.user.profile?.fullName ?? null,
    menteeId: booking.menteeId,
    menteeName: null,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    meetingUrl: booking.meetingUrl,
    notes: booking.notes,
    calEventUid: booking.calEventUid,
    createdAt: booking.createdAt,
  }));
};

export const getCoachBookingsFromDB = async (coachId: string): Promise<BookingSummary[]> => {
  const bookings = await prisma.booking.findMany({
    where: { coachId },
    include: {
      mentee: { select: { profile: { select: { fullName: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  return bookings.map((booking: any): BookingSummary => ({
    id: booking.id,
    coachId: booking.coachId,
    coachName: null,
    menteeId: booking.menteeId,
    menteeName: booking.mentee.profile?.fullName ?? null,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    meetingUrl: booking.meetingUrl,
    notes: booking.notes,
    calEventUid: booking.calEventUid,
    createdAt: booking.createdAt,
  }));
};

export const updateBookingStatusInDB = async (
  id: string,
  status: BookingStatusValue,
  data?: { meetingUrl?: string },
) => {
  return prisma.booking.update({
    where: { id },
    data: {
      status,
      ...(data?.meetingUrl != null ? { meetingUrl: data.meetingUrl } : {}),
    },
  });
};

export const findBookingByCalEventInDB = async (calEventUid: string) => {
  return prisma.booking.findFirst({ where: { calEventUid } });
};

export const findBookingByCoachAndStartInDB = async (
  coachId: string,
  startTime: Date,
) => {
  return prisma.booking.findUnique({
    where: { coachId_startTime: { coachId, startTime } },
  });
};
