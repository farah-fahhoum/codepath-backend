export type BookingStatusValue =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

export interface CoachProfile {
  id: string;
  specialty: string;
  bio: string | null;
  hourlyRate: string | null;
  isAvailable: boolean;
  bookingLink: string | null;
  user: {
    id: string;
    username: string;
    email: string;
    profile: {
      fullName: string | null;
      country: string | null;
      avatarUrl: string | null;
    } | null;
  };
}

export interface BookingSummary {
  id: string;
  coachId: string;
  coachName: string;
  menteeId: string;
  menteeName: string;
  startTime: Date;
  endTime: Date;
  status: string;
  meetingUrl: string | null;
  notes: string | null;
  calEventUid: string | null;
  createdAt: Date;
}
