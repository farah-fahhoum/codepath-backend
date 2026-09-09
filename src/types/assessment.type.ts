export type SkillConfidence = "high" | "medium" | "low";
export type SkillPrimarySource =
  | "codeforces"
  | "codepath"
  | "contest"
  | "placement"
  | "blended"
  | "none";

export type AssessmentMethod = "ai" | "rules";

export type SkillSyncStatus =
  | "idle"
  | "pending_choice"
  | "syncing"
  | "complete"
  | "failed";

export type SkillLevelPreference =
  | "auto"
  | "blended"
  | "codeforces"
  | "codepath"
  | "contest"
  | "placement";

export type ProblemAttemptSource = "practice" | "contest" | "external_sync";

export interface CodeforcesSkillSource {
  connected: boolean;
  handle: string | null;
  rating: number | null;
  problemsSolved: number;
  accuracy: number | null;
}

export interface CodePathSkillSource {
  solvedCount: number;
  attemptedCount: number;
  avgSolvedRating: number;
  accuracy: number;
  topicPerformance: Array<{
    topic: string;
    attempts: number;
    solved: number;
    accuracy: number;
  }>;
}

export interface ContestSkillSource {
  participatedCount: number;
  finishedCount: number;
  avgSolveRate: number;
  avgProblemRating: number;
  totalContestSolves: number;
}

export interface PlacementSkillSource {
  skillLevelId: number;
  skillLevelTitle: string;
  assessmentType: string;
  score: number;
  assessedAt: string;
}

export interface SourceContribution {
  source: Exclude<SkillPrimarySource, "none" | "blended">;
  tier: string;
  rating: number | null;
  weight: number;
  label: string;
}

export interface MenteeSkillProfileSources {
  codeforces: CodeforcesSkillSource;
  codepath: CodePathSkillSource;
  contest: ContestSkillSource;
  placement: PlacementSkillSource | null;
}

export interface AssessmentMethodOption {
  method: AssessmentMethod;
  label: string;
  description: string;
  previewTier?: string;
  previewRating?: number | null;
}

export interface MenteeSkillProfile {
  tier: string;
  rating: number | null;
  confidence: SkillConfidence;
  primarySource: SkillPrimarySource;
  levelPreference: SkillLevelPreference;
  assessmentMethod: AssessmentMethod;
  skillLevelId: number | null;
  sources: MenteeSkillProfileSources;
  contributions?: SourceContribution[];
  reasoning?: string;
  syncStatus?: SkillSyncStatus;
  syncError?: string | null;
  computedAt: string;
}
