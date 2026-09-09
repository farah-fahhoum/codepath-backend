import { tierFromRating } from "./skillTier";
import type {
  MenteeSkillProfileSources,
  SkillConfidence,
  SkillLevelPreference,
  SkillPrimarySource,
  SourceContribution,
  AssessmentMethodOption,
} from "../types/assessment.type";
import { CODEPATH_MIN_SOLVED_FOR_ESTIMATE, CONTEST_MIN_FINISHED_FOR_ESTIMATE } from "./skillTier";

const TIER_MID_RATING: Record<string, number> = {
  Beginner: 1050,
  Intermediate: 1300,
  Advanced: 1500,
  Expert: 1750,
  Master: 2200,
  "Not Assessed": 1100,
};

export interface BlendedAssessmentResult {
  tier: string;
  rating: number | null;
  confidence: SkillConfidence;
  primarySource: SkillPrimarySource;
  contributions: SourceContribution[];
  reasoning: string;
}

function tierMidRating(tier: string): number {
  return TIER_MID_RATING[tier] ?? 1100;
}

function placementWeight(score: number): number {
  return 0.15 + Math.min(0.15, score / 500);
}

function buildContributions(
  sources: MenteeSkillProfileSources,
): SourceContribution[] {
  const items: SourceContribution[] = [];

  if (sources.codeforces.connected && sources.codeforces.rating != null) {
    const rating = sources.codeforces.rating;
    items.push({
      source: "codeforces",
      tier: tierFromRating(rating),
      rating,
      weight: 0.4,
      label: `Codeforces rating ${rating}`,
    });
  }

  if (sources.placement) {
    const tier = sources.placement.skillLevelTitle;
    items.push({
      source: "placement",
      tier,
      rating: tierMidRating(tier),
      weight: placementWeight(sources.placement.score),
      label: `${sources.placement.assessmentType} placement (${tier})`,
    });
  }

  if (
    sources.codepath.solvedCount >= CODEPATH_MIN_SOLVED_FOR_ESTIMATE &&
    sources.codepath.avgSolvedRating > 0
  ) {
    const rating = Math.round(sources.codepath.avgSolvedRating);
    items.push({
      source: "codepath",
      tier: tierFromRating(rating),
      rating,
      weight: Math.min(0.25, 0.12 + sources.codepath.solvedCount * 0.01),
      label: `${sources.codepath.solvedCount} CodePath solves`,
    });
  }

  if (
    sources.contest.finishedCount >= CONTEST_MIN_FINISHED_FOR_ESTIMATE &&
    sources.contest.avgProblemRating > 0
  ) {
    const rating = Math.round(sources.contest.avgProblemRating);
    items.push({
      source: "contest",
      tier: tierFromRating(rating),
      rating,
      weight: Math.min(0.2, 0.1 + sources.contest.finishedCount * 0.03),
      label: `${sources.contest.finishedCount} contests finished`,
    });
  }

  return items;
}

function codepathContributionFromSources(
  sources: MenteeSkillProfileSources,
): SourceContribution {
  const existing = buildContributions(sources).find((item) => item.source === "codepath");
  if (existing) return existing;

  if (sources.codepath.solvedCount <= 0) {
    return {
      source: "codepath",
      tier: "Not Assessed",
      rating: null,
      weight: 1,
      label: "0 CodePath solves",
    };
  }

  const rating =
    sources.codepath.avgSolvedRating > 0
      ? Math.round(sources.codepath.avgSolvedRating)
      : tierMidRating("Beginner");

  return {
    source: "codepath",
    tier: tierFromRating(rating),
    rating,
    weight: Math.min(0.25, 0.12 + sources.codepath.solvedCount * 0.01),
    label: `${sources.codepath.solvedCount} CodePath solves`,
  };
}

function codeforcesContributionFromSources(
  sources: MenteeSkillProfileSources,
): SourceContribution | null {
  const existing = buildContributions(sources).find((item) => item.source === "codeforces");
  if (existing) return existing;

  if (!sources.codeforces.connected || sources.codeforces.rating == null) {
    return null;
  }

  const rating = sources.codeforces.rating;
  return {
    source: "codeforces",
    tier: tierFromRating(rating),
    rating,
    weight: 0.4,
    label: `Codeforces rating ${rating}`,
  };
}

function normalizeWeights(contributions: SourceContribution[]): SourceContribution[] {
  const total = contributions.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return contributions;
  return contributions.map((item) => ({
    ...item,
    weight: item.weight / total,
  }));
}

function pickPrimarySource(
  contributions: SourceContribution[],
): SkillPrimarySource {
  if (contributions.length === 0) return "none";
  const sorted = [...contributions].sort((a, b) => b.weight - a.weight);
  return sorted[0]?.source ?? "none";
}

function confidenceFromContributions(
  contributions: SourceContribution[],
): SkillConfidence {
  if (contributions.length >= 3) return "high";
  if (contributions.length === 2) return "medium";
  if (contributions.length === 1) {
    return contributions[0].source === "codeforces" ? "high" : "low";
  }
  return "low";
}

export function blendSkillAssessment(
  sources: MenteeSkillProfileSources,
  preference: SkillLevelPreference = "auto",
): BlendedAssessmentResult {
  if (!sources.codeforces.connected) {
    const codepathOnly = { ...codepathContributionFromSources(sources), weight: 1 };
    return {
      tier: codepathOnly.tier,
      rating: codepathOnly.rating,
      confidence: codepathOnly.rating != null ? "medium" : "low",
      primarySource: "codepath",
      contributions: [codepathOnly],
      reasoning: `Based on ${codepathOnly.label}.`,
    };
  }

  let contributions = buildContributions(sources);

  if (contributions.length === 0) {
    return {
      tier: "Not Assessed",
      rating: null,
      confidence: "low",
      primarySource: "none",
      contributions: [],
      reasoning: "No skill signals available yet.",
    };
  }

  if (preference !== "auto" && preference !== "blended") {
    const preferred = contributions.find((item) => item.source === preference);
    if (preferred) {
      contributions = [{ ...preferred, weight: 1 }];
    } else if (preference === "codepath") {
      contributions = [{ ...codepathContributionFromSources(sources), weight: 1 }];
    } else if (preference === "codeforces") {
      const cf = codeforcesContributionFromSources(sources);
      if (cf) contributions = [{ ...cf, weight: 1 }];
    }
  } else {
    if (sources.codeforces.connected) {
      contributions = contributions.filter(
        (item) => item.source === "codeforces" || item.source === "codepath",
      );
      if (!contributions.some((item) => item.source === "codepath")) {
        contributions.push(codepathContributionFromSources(sources));
      }
      if (!contributions.some((item) => item.source === "codeforces")) {
        const cf = codeforcesContributionFromSources(sources);
        if (cf) contributions.unshift(cf);
      }
    }
    contributions = normalizeWeights(contributions);
  }

  const rated = contributions.filter((item) => item.rating != null);
  const blendedRating =
    rated.length > 0
      ? Math.round(
          rated.reduce((sum, item) => sum + (item.rating ?? 0) * item.weight, 0) /
            rated.reduce((sum, item) => sum + item.weight, 0),
        )
      : tierMidRating(contributions[0].tier);

  const tier = tierFromRating(blendedRating);
  const primarySource =
    preference === "blended" || preference === "auto"
      ? "blended"
      : pickPrimarySource(contributions);
  const confidence = confidenceFromContributions(buildContributions(sources));

  const reasoningParts = contributions.map(
    (item) =>
      `${item.label}: ${item.tier}${item.rating != null ? ` (~${item.rating})` : ""} [${Math.round(item.weight * 100)}%]`,
  );

  return {
    tier,
    rating: blendedRating,
    confidence,
    primarySource,
    contributions,
    reasoning: `Blended from ${reasoningParts.join("; ")}.`,
  };
}

export function listAssessmentMethodOptions(
  sources: MenteeSkillProfileSources,
): AssessmentMethodOption[] {
  const rulesPreview = blendSkillAssessment(sources, "blended");
  return [
    {
      method: "rules",
      label: "Combined signals",
      description: "Your level is calculated from the activity sources you choose.",
      previewTier: rulesPreview.tier,
      previewRating: rulesPreview.rating,
    },
  ];
}

export function listLevelOptions(
  sources: MenteeSkillProfileSources,
): Array<{
  preference: SkillLevelPreference;
  label: string;
  tier: string;
  rating: number | null;
  description: string;
}> {
  if (!sources.codeforces.connected) {
    return [];
  }

  const blended = blendSkillAssessment(sources, "blended");
  const codeforces = blendSkillAssessment(sources, "codeforces");
  const codepath = blendSkillAssessment(sources, "codepath");

  return [
    {
      preference: "blended",
      label: "Everything combined",
      tier: blended.tier,
      rating: blended.rating,
      description:
        "Combines your Codeforces rating with your CodePath solve history.",
    },
    {
      preference: "codeforces",
      label: "Codeforces only",
      tier: codeforces.tier,
      rating: codeforces.rating,
      description: "Your level follows your connected Codeforces rating.",
    },
    {
      preference: "codepath",
      label: "CodePath only",
      tier: codepath.tier,
      rating: codepath.rating,
      description: "Your level is based on problems you have solved on CodePath.",
    },
  ];
}
