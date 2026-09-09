export type ContestStatusValue =
  | "DRAFT"
  | "SCHEDULED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";

export interface ContestCodePathProblemSummary {
  id: string;
  slug: string;
  title: string;
  rating: number;
  tags: string[];
}

export interface ContestProblemSummary {
  id: string;
  label: string;
  order: number;
  codePathProblem: ContestCodePathProblemSummary;
}

export type ContestDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface ContestSummary {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  difficulty: ContestDifficulty;
  durationMinutes: number;
  scheduledStartTime: Date | null;
  scheduledEndTime: Date | null;
  freezeEnabled: boolean;
  freezeMinutes: number | null;
  virtualStartTime: Date | null;
  rulesOfEngagement: string[];
  createdAt: Date;
  problemCount: number;
  participantCount: number;
  activeParticipantCount: number;
  myProgress?: {
    solvedCount: number;
    totalProblems: number;
    rank: number | null;
    isParticipant: boolean;
  };
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
