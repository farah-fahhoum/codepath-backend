export type ContestStatusValue =
  | "DRAFT"
  | "SCHEDULED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";

export interface ContestProblemSummary {
  id: string;
  label: string;
  order: number;
  problem: {
    id: number;
    externalProblemId: string;
    contestId: number;
    index: string;
    rating: number;
    title: string | null;
  } | null;
  topic: { id: number; title: string } | null;
}

export interface ContestSummary {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  durationMinutes: number;
  freezeEnabled: boolean;
  freezeMinutes: number | null;
  virtualStartTime: Date | null;
  createdAt: Date;
  problemCount: number;
  participantCount: number;
}

export interface ScoreboardProblemCell {
  label: string;
  accepted: boolean;
  timeMinutes: number | null;
  wrongAttempts: number;
}

export interface ScoreboardRow {
  rank: number;
  participantId: string;
  userId: string;
  username: string;
  fullName: string | null;
  solvedCount: number;
  penalty: number;
  problems: ScoreboardProblemCell[];
}
