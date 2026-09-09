import { prisma } from "../lib/prisma";
import {
  getCodeforcesHandleForUser,
} from "./externalAccount.repo";
import {
  fetchCodeforcesUserInfo,
  fetchCodeforcesSkillSummary,
} from "../lib/codeforcesClient";
import type {
  CodeforcesSkillSource,
  CodePathSkillSource,
  ContestSkillSource,
  PlacementSkillSource,
  MenteeSkillProfileSources,
} from "../types/assessment.type";

function parseTagsJson(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function getLatestPlacementFromDB(
  userId: string,
): Promise<PlacementSkillSource | null> {
  const row = await prisma.userSkillAssessment.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { skillLevel: { select: { id: true, title: true } } },
  });
  if (!row?.skillLevel) return null;
  return {
    skillLevelId: row.skillLevelId,
    skillLevelTitle: row.skillLevel.title,
    assessmentType: row.assessmentType,
    score: row.score,
    assessedAt: row.createdAt.toISOString(),
  };
}

export async function getCodeforcesSkillSourceFromDB(
  userId: string,
  mode: "quick" | "full" = "full",
): Promise<CodeforcesSkillSource> {
  const handle = await getCodeforcesHandleForUser(userId);
  if (!handle) {
    return {
      connected: false,
      handle: null,
      rating: null,
      problemsSolved: 0,
      accuracy: null,
    };
  }

  if (mode === "quick") {
    const info = await fetchCodeforcesUserInfo(handle);
    const snapshot = await getSkillSnapshotFromDB(userId);
    const cachedSources = snapshot?.sourcesJson as
      | { codeforces?: CodeforcesSkillSource; codepath?: { solvedCount?: number } }
      | undefined;
    const cachedCf = cachedSources?.codeforces;
    const cachedCodepathCount = cachedSources?.codepath?.solvedCount ?? 0;
    const preservedCount = cachedCf?.problemsSolved ?? 0;
    const trustedCount =
      preservedCount > 0 && preservedCount !== cachedCodepathCount
        ? preservedCount
        : 0;

    return {
      connected: true,
      handle,
      rating: info?.rating ?? cachedCf?.rating ?? null,
      problemsSolved: trustedCount,
      accuracy: cachedCf?.accuracy ?? null,
    };
  }

  const [info, summary] = await Promise.all([
    fetchCodeforcesUserInfo(handle),
    fetchCodeforcesSkillSummary(handle),
  ]);

  return {
    connected: true,
    handle,
    rating: info?.rating ?? null,
    problemsSolved: summary.problemsSolved,
    accuracy: summary.accuracy,
  };
}

export async function getCodePathSkillSourceFromDB(
  userId: string,
): Promise<CodePathSkillSource> {
  const [submissions, attempts, topics] = await Promise.all([
    prisma.codePathSubmission.findMany({
      where: { userId },
      select: {
        verdict: true,
        problemId: true,
        problem: { select: { rating: true, tags: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userProblemAttempt.findMany({
      where: { userId, platform: "CodePath" },
      select: { externalProblemId: true, solved: true, attemptCount: true },
    }),
    prisma.topic.findMany({ select: { id: true, title: true, tags: true } }),
  ]);

  const solvedProblemIds = new Set<string>();
  const solvedRatings: number[] = [];

  for (const sub of submissions) {
    if (sub.verdict === "AC") {
      solvedProblemIds.add(sub.problemId);
      solvedRatings.push(sub.problem.rating);
    }
  }
  for (const att of attempts) {
    if (att.solved) solvedProblemIds.add(att.externalProblemId);
  }

  const attemptedCount = submissions.length;
  const solvedCount = solvedProblemIds.size;
  const avgSolvedRating =
    solvedRatings.length > 0
      ? solvedRatings.reduce((a, b) => a + b, 0) / solvedRatings.length
      : 0;
  const accuracy =
    attemptedCount > 0
      ? Math.round((submissions.filter((s) => s.verdict === "AC").length / attemptedCount) * 100)
      : 0;

  const keywordsByTopic = topics.map((topic) => ({
    title: topic.title,
    keywords: topic.title
      .toLowerCase()
      .split(/\s+/)
      .concat((topic.tags || "").split(",").map((t) => t.trim().toLowerCase()))
      .filter((k) => k.length > 0),
  }));

  const topicStats = new Map<string, { attempts: number; solved: number }>();

  for (const sub of submissions) {
    const tags = parseTagsJson(sub.problem.tags);
    const isSolved = sub.verdict === "AC";
    for (const tag of tags) {
      for (const topic of keywordsByTopic) {
        const matches = topic.keywords.some(
          (kw) => kw === tag.toLowerCase() || tag.toLowerCase().includes(kw),
        );
        if (matches) {
          const entry = topicStats.get(topic.title) ?? { attempts: 0, solved: 0 };
          entry.attempts += 1;
          if (isSolved) entry.solved += 1;
          topicStats.set(topic.title, entry);
          break;
        }
      }
    }
  }

  const topicPerformance = Array.from(topicStats.entries())
    .map(([topic, stats]) => ({
      topic,
      attempts: stats.attempts,
      solved: stats.solved,
      accuracy:
        stats.attempts > 0
          ? Math.round((stats.solved / stats.attempts) * 100)
          : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  return {
    solvedCount,
    attemptedCount,
    avgSolvedRating,
    accuracy,
    topicPerformance,
  };
}

export async function getContestSkillSourceFromDB(
  userId: string,
): Promise<ContestSkillSource> {
  const participants = await prisma.contestParticipant.findMany({
    where: { userId },
    include: {
      contest: {
        include: {
          problems: {
            include: { codePathProblem: { select: { rating: true } } },
          },
        },
      },
      submissions: {
        include: {
          contestProblem: {
            include: { codePathProblem: { select: { rating: true } } },
          },
        },
      },
    },
  });

  if (participants.length === 0) {
    return {
      participatedCount: 0,
      finishedCount: 0,
      avgSolveRate: 0,
      avgProblemRating: 0,
      totalContestSolves: 0,
    };
  }

  let finishedCount = 0;
  let solveRateSum = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let totalContestSolves = 0;

  for (const p of participants) {
    if (p.finished) finishedCount += 1;

    const problemCount = p.contest.problems.length;
    const solvedLabels = new Set<string>();
    for (const sub of p.submissions) {
      if (sub.verdict === "AC") {
        solvedLabels.add(sub.contestProblemId);
        totalContestSolves += 1;
        const rating = sub.contestProblem.codePathProblem.rating;
        ratingSum += rating;
        ratingCount += 1;
      }
    }

    if (problemCount > 0) {
      solveRateSum += solvedLabels.size / problemCount;
    }
  }

  return {
    participatedCount: participants.length,
    finishedCount,
    avgSolveRate:
      participants.length > 0 ? solveRateSum / participants.length : 0,
    avgProblemRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
    totalContestSolves,
  };
}

export async function updateSkillSyncStatusInDB(
  userId: string,
  syncStatus: string,
  syncError: string | null = null,
): Promise<void> {
  await prisma.userSkillSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      tier: "Not Assessed",
      confidence: "low",
      primarySource: "none",
      syncStatus,
      syncError,
      sourcesJson: {},
    },
    update: {
      syncStatus,
      syncError,
    },
  });
}

export async function getSkillSyncStatusFromDB(userId: string) {
  const snapshot = await prisma.userSkillSnapshot.findUnique({
    where: { userId },
    select: { syncStatus: true, syncError: true, updatedAt: true },
  });
  return {
    status: (snapshot?.syncStatus ?? "idle") as
      | "idle"
      | "pending_choice"
      | "syncing"
      | "complete"
      | "failed",
    error: snapshot?.syncError ?? null,
    updatedAt: snapshot?.updatedAt?.toISOString() ?? null,
  };
}

export async function upsertSkillSnapshotInDB(
  userId: string,
  data: {
    tier: string;
    rating: number | null;
    confidence: string;
    primarySource: string;
    levelPreference?: string;
    assessmentMethod?: string;
    assessmentReasoning?: string | null;
    sourcesJson: object;
    skillLevelId: number | null;
    syncStatus?: string;
    syncError?: string | null;
  },
) {
  return prisma.userSkillSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      tier: data.tier,
      rating: data.rating,
      confidence: data.confidence,
      primarySource: data.primarySource,
      levelPreference: data.levelPreference ?? "auto",
      assessmentMethod: data.assessmentMethod ?? "rules",
      assessmentReasoning: data.assessmentReasoning ?? null,
      sourcesJson: data.sourcesJson,
      skillLevelId: data.skillLevelId,
      syncStatus: data.syncStatus ?? "idle",
      syncError: data.syncError ?? null,
      computedAt: new Date(),
    },
    update: {
      tier: data.tier,
      rating: data.rating,
      confidence: data.confidence,
      primarySource: data.primarySource,
      levelPreference: data.levelPreference ?? "auto",
      assessmentMethod: data.assessmentMethod ?? "rules",
      assessmentReasoning: data.assessmentReasoning ?? null,
      sourcesJson: data.sourcesJson,
      skillLevelId: data.skillLevelId,
      ...(data.syncStatus !== undefined ? { syncStatus: data.syncStatus } : {}),
      ...(data.syncError !== undefined ? { syncError: data.syncError } : {}),
      computedAt: new Date(),
    },
  });
}

export async function getSkillLevelPreferenceFromDB(
  userId: string,
): Promise<string> {
  const snapshot = await prisma.userSkillSnapshot.findUnique({
    where: { userId },
    select: { levelPreference: true },
  });
  return snapshot?.levelPreference ?? "auto";
}

export async function setSkillLevelPreferenceInDB(
  userId: string,
  levelPreference: string,
): Promise<void> {
  await prisma.userSkillSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      tier: "Not Assessed",
      confidence: "low",
      primarySource: "none",
      levelPreference,
      sourcesJson: {},
    },
    update: {
      levelPreference,
    },
  });
}

export async function getAssessmentMethodFromDB(
  userId: string,
): Promise<string> {
  const snapshot = await prisma.userSkillSnapshot.findUnique({
    where: { userId },
    select: { assessmentMethod: true },
  });
  return snapshot?.assessmentMethod ?? "rules";
}

export async function setAssessmentMethodInDB(
  userId: string,
  assessmentMethod: string,
): Promise<void> {
  await prisma.userSkillSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      tier: "Not Assessed",
      confidence: "low",
      primarySource: "none",
      assessmentMethod,
      sourcesJson: {},
    },
    update: {
      assessmentMethod,
    },
  });
}

export async function markPendingLevelChoiceInDB(
  userId: string,
  sourcesJson: object,
): Promise<void> {
  const existing = await prisma.userSkillSnapshot.findUnique({
    where: { userId },
  });

  if (existing) {
    await prisma.userSkillSnapshot.update({
      where: { userId },
      data: {
        sourcesJson,
        syncStatus: "pending_choice",
        syncError: null,
      },
    });
    return;
  }

  await prisma.userSkillSnapshot.create({
    data: {
      userId,
      tier: "Not Assessed",
      confidence: "low",
      primarySource: "none",
      sourcesJson,
      syncStatus: "pending_choice",
    },
  });
}

export async function patchCodeforcesProblemsSolvedInSnapshot(
  userId: string,
  problemsSolved: number,
  accuracy: number | null,
): Promise<void> {
  const snapshot = await getSkillSnapshotFromDB(userId);
  const handle = await getCodeforcesHandleForUser(userId);
  if (!handle) return;

  const sources = (snapshot?.sourcesJson ?? {
    codeforces: {
      connected: false,
      handle: null,
      rating: null,
      problemsSolved: 0,
      accuracy: null,
    },
    codepath: { solvedCount: 0, accuracy: 0, avgSolvedRating: 0 },
    contest: { finishedCount: 0, avgProblemRating: 0 },
    placement: null,
  }) as MenteeSkillProfileSources;

  await prisma.userSkillSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      tier: "Not Assessed",
      confidence: "low",
      primarySource: "none",
      sourcesJson: {
        ...sources,
        codeforces: {
          ...sources.codeforces,
          connected: true,
          handle,
          problemsSolved,
          accuracy,
        },
      },
    },
    update: {
      sourcesJson: {
        ...sources,
        codeforces: {
          ...sources.codeforces,
          connected: true,
          handle,
          problemsSolved,
          accuracy,
        },
      },
    },
  });
}

export async function getSkillSnapshotFromDB(userId: string) {
  return prisma.userSkillSnapshot.findUnique({
    where: { userId },
    include: { skillLevel: { select: { id: true, title: true } } },
  });
}

export async function countMenteesBySnapshotTierFromDB(): Promise<
  { level: string; total: number }[]
> {
  const skillLevels = await prisma.skillLevel.findMany({
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });

  const menteeRole = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });
  if (!menteeRole) {
    return skillLevels.map((l) => ({ level: l.title, total: 0 }));
  }

  const snapshots = await prisma.userSkillSnapshot.findMany({
    where: {
      user: { roleId: menteeRole.id },
    },
    select: { tier: true, userId: true },
  });

  const counts = new Map<string, number>();
  for (const s of snapshots) {
    counts.set(s.tier, (counts.get(s.tier) ?? 0) + 1);
  }

  const notAssessedMentees = await prisma.user.count({
    where: {
      roleId: menteeRole.id,
      skillSnapshot: null,
    },
  });

  const results = skillLevels.map((l) => ({
    level: l.title,
    total: counts.get(l.title) ?? 0,
  }));

  if (notAssessedMentees > 0) {
    results.push({ level: "Not Assessed", total: notAssessedMentees });
  }

  return results;
}
