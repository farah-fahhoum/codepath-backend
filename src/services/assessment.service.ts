import { getSkillLevelByTitle } from "../repositories/skillLevel.repo";
import { prisma } from "../lib/prisma";
import {
  getCodeforcesSkillSourceFromDB,
  getCodePathSkillSourceFromDB,
  getContestSkillSourceFromDB,
  getLatestPlacementFromDB,
  getSkillSnapshotFromDB,
  getSkillLevelPreferenceFromDB,
  setSkillLevelPreferenceInDB,
  getAssessmentMethodFromDB,
  setAssessmentMethodInDB,
  markPendingLevelChoiceInDB,
  upsertSkillSnapshotInDB,
  updateSkillSyncStatusInDB,
  getSkillSyncStatusFromDB,
  patchCodeforcesProblemsSolvedInSnapshot,
} from "../repositories/assessment.repo";
import { getCodeforcesHandleForUser } from "../repositories/externalAccount.repo";
import { fetchCodeforcesSkillSummary } from "../lib/codeforcesClient";
import { NOT_ASSESSED_TIER } from "../lib/skillTier";
import {
  blendSkillAssessment,
  listLevelOptions,
  listAssessmentMethodOptions,
} from "../lib/skillBlend";
import { evaluateSkillAssessment } from "../lib/fastapiClient";
import type {
  AssessmentMethod,
  MenteeSkillProfile,
  MenteeSkillProfileSources,
  SkillConfidence,
  SkillLevelPreference,
  SkillPrimarySource,
  SkillSyncStatus,
  SourceContribution,
} from "../types/assessment.type";
import { FastAPIError } from "../lib/fastapiClient";
import { CodeforcesApiError } from "../lib/codeforcesClient";

export interface ComputeSkillProfileOptions {
  /** Skip Gemini call — use deterministic blend only (fast). */
  skipAi?: boolean;
  /** quick = rating only from CF; full = scan all submissions. */
  cfMode?: "quick" | "full";
}

const pendingFullRefresh = new Set<string>();

async function resolveSkillLevelId(tier: string): Promise<number | null> {
  if (tier === NOT_ASSESSED_TIER) return null;
  const level = await getSkillLevelByTitle(tier);
  return level?.id ?? null;
}

function mapProfileFromSnapshot(
  cached: NonNullable<Awaited<ReturnType<typeof getSkillSnapshotFromDB>>>,
): MenteeSkillProfile {
  const sources = cached.sourcesJson as unknown as MenteeSkillProfileSources;
  const blended = blendSkillAssessment(
    sources,
    (cached.levelPreference as SkillLevelPreference) ?? "auto",
  );

  return {
    tier: cached.tier,
    rating: cached.rating,
    confidence: cached.confidence as SkillConfidence,
    primarySource: cached.primarySource as SkillPrimarySource,
    levelPreference: (cached.levelPreference as SkillLevelPreference) ?? "auto",
    assessmentMethod: (cached.assessmentMethod as AssessmentMethod) ?? "rules",
    skillLevelId: cached.skillLevelId,
    sources,
    contributions: blended.contributions,
    reasoning: cached.assessmentReasoning ?? blended.reasoning,
    syncStatus: (cached.syncStatus as SkillSyncStatus) ?? "idle",
    syncError: cached.syncError ?? null,
    computedAt: cached.computedAt.toISOString(),
  };
}

function formatRefreshError(err: unknown): string {
  if (err instanceof CodeforcesApiError) {
    return `${err.message}. Check your internet connection and try syncing again.`;
  }
  if (err instanceof FastAPIError) {
    if (err.status === 503 || err.status === 504) {
      return "AI service is unavailable right now. Please try again later.";
    }
    return err.message || "AI assessment failed.";
  }
  if (err instanceof Error) {
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(err.message)) {
      return "Could not reach the AI service. Check your connection and try again.";
    }
    return err.message;
  }
  return "Skill sync failed. Please try reconnecting Codeforces.";
}

export class SkillSyncInProgressError extends Error {
  constructor() {
    super("Skill sync is still in progress. Please wait until it finishes.");
    this.name = "SkillSyncInProgressError";
  }
}

export async function assertSkillSyncNotInProgress(userId: string): Promise<void> {
  const sync = await getSkillSyncStatusFromDB(userId);
  if (sync.status === "syncing") {
    throw new SkillSyncInProgressError();
  }
}

export async function getSkillSyncStatus(userId: string) {
  return getSkillSyncStatusFromDB(userId);
}

/** Live Codeforces solved count from the CF API, with snapshot cache update. */
export async function resolveCodeforcesProblemsSolvedCount(
  userId: string,
): Promise<number> {
  const handle = await getCodeforcesHandleForUser(userId);
  if (!handle) {
    const profile = await getMenteeSkillProfile(userId);
    return profile.sources.codepath.solvedCount;
  }

  const profile = await getMenteeSkillProfile(userId);
  const cached = profile.sources.codeforces.problemsSolved;
  const codepathCount = profile.sources.codepath.solvedCount;
  const looksStale =
    cached === 0 || (codepathCount > 0 && cached === codepathCount);

  if (!looksStale && cached > 0) {
    return cached;
  }

  try {
    const summary = await fetchCodeforcesSkillSummary(handle);
    await patchCodeforcesProblemsSolvedInSnapshot(
      userId,
      summary.problemsSolved,
      summary.accuracy,
    );
    return summary.problemsSolved;
  } catch (err) {
    console.error("[resolveCodeforcesProblemsSolvedCount] failed:", err);
    if (cached > 0 && cached !== codepathCount) return cached;
    return 0;
  }
}

async function gatherSources(
  userId: string,
  cfMode: "quick" | "full",
): Promise<MenteeSkillProfileSources> {
  const [codeforces, codepath, contest, placement] = await Promise.all([
    getCodeforcesSkillSourceFromDB(userId, cfMode),
    getCodePathSkillSourceFromDB(userId),
    getContestSkillSourceFromDB(userId),
    getLatestPlacementFromDB(userId),
  ]);
  return { codeforces, codepath, contest, placement };
}

/** Align snapshot CF flags with the live external-account link. */
async function enrichSourcesWithExternalAccount(
  userId: string,
  sources: MenteeSkillProfileSources,
): Promise<MenteeSkillProfileSources> {
  const handle = await getCodeforcesHandleForUser(userId);
  if (!handle) {
    return {
      ...sources,
      codeforces: {
        connected: false,
        handle: null,
        rating: null,
        problemsSolved: 0,
        accuracy: null,
      },
    };
  }

  return {
    ...sources,
    codeforces: {
      ...sources.codeforces,
      connected: true,
      handle,
    },
  };
}

async function enrichMenteeSkillProfile(
  userId: string,
  profile: MenteeSkillProfile,
): Promise<MenteeSkillProfile> {
  const sources = await enrichSourcesWithExternalAccount(userId, profile.sources);
  return { ...profile, sources };
}

async function evaluateWithAi(
  userId: string,
  sources: MenteeSkillProfileSources,
  levelPreference: SkillLevelPreference,
): Promise<{
  tier: string;
  rating: number | null;
  confidence: SkillConfidence;
  primarySource: SkillPrimarySource;
  contributions: SourceContribution[];
  reasoning: string;
}> {
  const ai = await evaluateSkillAssessment({
    userId,
    levelPreference,
    codeforces: sources.codeforces,
    codepath: sources.codepath,
    contest: sources.contest,
    placement: sources.placement,
  });
  return {
    tier: ai.tier,
    rating: ai.rating,
    confidence: ai.confidence as SkillConfidence,
    primarySource: ai.primarySource as SkillPrimarySource,
    contributions: ai.contributions as SourceContribution[],
    reasoning: ai.reasoning,
  };
}

async function saveSkillProfile(
  userId: string,
  sources: MenteeSkillProfileSources,
  preference: SkillLevelPreference,
  assessmentMethod: AssessmentMethod,
  result: {
    tier: string;
    rating: number | null;
    confidence: SkillConfidence;
    primarySource: SkillPrimarySource;
    contributions: SourceContribution[];
    reasoning: string;
  },
): Promise<MenteeSkillProfile> {
  const skillLevelId = await resolveSkillLevelId(result.tier);
  const profile: MenteeSkillProfile = {
    tier: result.tier,
    rating: result.rating,
    confidence: result.confidence,
    primarySource: result.primarySource,
    levelPreference: preference,
    assessmentMethod,
    skillLevelId,
    sources,
    contributions: result.contributions,
    reasoning: result.reasoning,
    computedAt: new Date().toISOString(),
  };

  await upsertSkillSnapshotInDB(userId, {
    tier: profile.tier,
    rating: profile.rating,
    confidence: profile.confidence,
    primarySource: profile.primarySource,
    levelPreference: profile.levelPreference,
    assessmentMethod: profile.assessmentMethod,
    assessmentReasoning: profile.reasoning ?? null,
    sourcesJson: profile.sources,
    skillLevelId: profile.skillLevelId,
  });

  return profile;
}

export async function computeSkillProfile(
  userId: string,
  options: ComputeSkillProfileOptions = {},
): Promise<MenteeSkillProfile> {
  const cfMode = options.cfMode ?? "full";
  const skipAi = options.skipAi ?? false;

  const [sources, levelPreference, assessmentMethod] = await Promise.all([
    gatherSources(userId, cfMode),
    getSkillLevelPreferenceFromDB(userId),
    getAssessmentMethodFromDB(userId),
  ]);

  const preference = (levelPreference as SkillLevelPreference) ?? "auto";
  const method = (assessmentMethod as AssessmentMethod) ?? "rules";
  const blended = blendSkillAssessment(sources, preference);

  let result = {
    tier: blended.tier,
    rating: blended.rating,
    confidence: blended.confidence,
    primarySource: blended.primarySource,
    contributions: blended.contributions,
    reasoning: blended.reasoning,
  };

  if (!skipAi && method === "ai") {
    try {
      result = await evaluateWithAi(userId, sources, preference);
    } catch (err) {
      console.error("[computeSkillProfile] AI assessment failed:", err);
    }
  }

  return saveSkillProfile(userId, sources, preference, method, result);
}

/** Fast refresh for interactive requests (no CF full scan, no AI). */
export async function refreshSkillSnapshotFast(
  userId: string,
): Promise<MenteeSkillProfile> {
  return computeSkillProfile(userId, { skipAi: true, cfMode: "quick" });
}

/** Full refresh (all submissions). Respects assessmentMethod — no silent AI fallback. */
async function runFullSkillSnapshotRefresh(userId: string): Promise<void> {
  await updateSkillSyncStatusInDB(userId, "syncing", null);

  try {
    const [preferenceRaw, assessmentMethodRaw, sources] = await Promise.all([
      getSkillLevelPreferenceFromDB(userId),
      getAssessmentMethodFromDB(userId),
      gatherSources(userId, "full"),
    ]);

    const preference = (preferenceRaw as SkillLevelPreference) ?? "blended";
    const assessmentMethod = (assessmentMethodRaw as AssessmentMethod) ?? "rules";

    let result;
    if (assessmentMethod === "ai") {
      result = await evaluateWithAi(userId, sources, preference);
    } else {
      const blended = blendSkillAssessment(sources, preference);
      result = {
        tier: blended.tier,
        rating: blended.rating,
        confidence: blended.confidence,
        primarySource: blended.primarySource,
        contributions: blended.contributions,
        reasoning: blended.reasoning,
      };
    }

    await saveSkillProfile(userId, sources, preference, assessmentMethod, result);
    await updateSkillSyncStatusInDB(userId, "complete", null);
  } catch (err) {
    const message = formatRefreshError(err);
    await updateSkillSyncStatusInDB(userId, "failed", message);
    console.error("[runFullSkillSnapshotRefresh] failed:", err);
  }
}

/** Full refresh in background (all submissions + chosen assessment method). */
export function scheduleFullSkillSnapshotRefresh(userId: string): void {
  if (pendingFullRefresh.has(userId)) return;
  pendingFullRefresh.add(userId);

  void runFullSkillSnapshotRefresh(userId).finally(() => {
    pendingFullRefresh.delete(userId);
  });
}

export async function refreshSkillSnapshot(
  userId: string,
  options?: ComputeSkillProfileOptions,
): Promise<MenteeSkillProfile> {
  return computeSkillProfile(userId, options);
}

export async function getMenteeSkillProfile(
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<MenteeSkillProfile> {
  let profile: MenteeSkillProfile;

  if (!options?.forceRefresh) {
    const cached = await getSkillSnapshotFromDB(userId);
    if (cached) {
      profile = mapProfileFromSnapshot(cached);
    } else {
      profile = await computeSkillProfile(userId, { skipAi: true, cfMode: "quick" });
    }
  } else {
    profile = await computeSkillProfile(userId, { skipAi: true, cfMode: "quick" });
  }

  return enrichMenteeSkillProfile(userId, profile);
}

/** Store fresh sources and wait for user to pick level source (CF connected only). */
export async function prepareLevelChoiceAfterCfConnect(userId: string) {
  const sources = await gatherSources(userId, "quick");
  const levelOptions = listLevelOptions(sources);

  if (levelOptions.length <= 1) {
    await applyLevelAssessmentChoice(userId, "codepath", "rules");
    return {
      levelOptions: [],
      assessmentMethods: listAssessmentMethodOptions(sources),
      requiresLevelChoice: false,
    };
  }

  await markPendingLevelChoiceInDB(userId, sources);

  return {
    levelOptions,
    assessmentMethods: listAssessmentMethodOptions(sources),
    requiresLevelChoice: true,
  };
}

/** After disconnect — CodePath is the only source, apply it automatically. */
export async function prepareLevelChoiceAfterDisconnect(userId: string) {
  await applyLevelAssessmentChoice(userId, "codepath", "rules");

  return {
    levelOptions: [],
    assessmentMethods: [],
    requiresLevelChoice: false,
  };
}

export async function applyLevelAssessmentChoice(
  userId: string,
  preference: SkillLevelPreference,
  assessmentMethod: AssessmentMethod,
): Promise<MenteeSkillProfile> {
  await assertSkillSyncNotInProgress(userId);

  const effectivePreference =
    assessmentMethod === "ai" ? "blended" : preference;

  await Promise.all([
    setSkillLevelPreferenceInDB(userId, effectivePreference),
    setAssessmentMethodInDB(userId, assessmentMethod),
  ]);

  const profile = await refreshSkillSnapshotFast(userId);
  scheduleFullSkillSnapshotRefresh(userId);

  const { activateRoadmapForUserSkillProfile } = await import(
    "../repositories/roadmap.repo"
  );
  await activateRoadmapForUserSkillProfile(userId);

  return profile;
}

/** @deprecated Use applyLevelAssessmentChoice */
export async function setSkillLevelPreference(
  userId: string,
  preference: SkillLevelPreference,
  assessmentMethod: AssessmentMethod = "rules",
): Promise<MenteeSkillProfile> {
  return applyLevelAssessmentChoice(userId, preference, assessmentMethod);
}

export async function getSkillLevelOptions(userId: string) {
  await assertSkillSyncNotInProgress(userId);

  const cached = await getSkillSnapshotFromDB(userId);
  const sources =
    cached?.sourcesJson != null
      ? (cached.sourcesJson as unknown as MenteeSkillProfileSources)
      : await gatherSources(userId, "quick");

  const options = listLevelOptions(sources);

  if (options.length <= 1 && cached?.syncStatus === "pending_choice") {
    await applyLevelAssessmentChoice(userId, "codepath", "rules");
    return {
      options: [],
      assessmentMethods: listAssessmentMethodOptions(sources),
      currentPreference: "codepath" as SkillLevelPreference,
      currentAssessmentMethod: "rules" as AssessmentMethod,
      autoResolved: true,
    };
  }

  const [currentPreference, currentAssessmentMethod] = await Promise.all([
    getSkillLevelPreferenceFromDB(userId),
    getAssessmentMethodFromDB(userId),
  ]);

  return {
    options,
    assessmentMethods: listAssessmentMethodOptions(sources),
    currentPreference: currentPreference as SkillLevelPreference,
    currentAssessmentMethod: currentAssessmentMethod as AssessmentMethod,
  };
}

/** Backward-compatible tier + rating for existing callers. */
export async function getMenteeCodePathLevelFromProfile(
  userId: string,
): Promise<{ tier: string; rating: number }> {
  const profile = await getMenteeSkillProfile(userId);
  return {
    tier: profile.tier,
    rating: profile.rating ?? 0,
  };
}

/** Recompute snapshots for every mentee (e.g. after deploy). */
export async function backfillSkillSnapshotsForAllMentees(): Promise<number> {
  const menteeRole = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });
  if (!menteeRole) return 0;

  const mentees = await prisma.user.findMany({
    where: { roleId: menteeRole.id },
    select: { id: true },
  });

  let count = 0;
  for (const mentee of mentees) {
    await computeSkillProfile(mentee.id);
    count += 1;
  }
  return count;
}
