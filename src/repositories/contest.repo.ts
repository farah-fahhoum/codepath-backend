import { prisma } from "../lib/prisma";
import { selectContestProblems } from "../lib/fastapiClient";
import {
  getUserCodeforcesStatsFromDB,
  getUserQuizPerformanceFromDB,
} from "./roadmapAI.repo";
import {
  ContestDifficulty,
  ContestStatusValue,
  ContestSummary,
  ScoreboardProblemCell,
  ScoreboardRow,
} from "../types/contest.type";

const ACCEPTED_VERDICTS = ["AC", "Accepted", "OK"];
const IGNORED_VERDICTS = ["CE", "Compilation Error", "SKIPPED", "TESTING", ""];

export const DEFAULT_RULES_OF_ENGAGEMENT = [
  "Virtual Contests exactly mimic ACM-ICPC conditions.",
  "Code execution is compiled and run against strict test cases.",
  "Any wrong attempt inflicts a 20-minute penalty.",
  "Plagiarism check runs continuously in the background.",
];

export const problemLabelForIndex = (index: number): string => {
  return String.fromCharCode(65 + index);
};

const parseTags = (tagsJson: string): string[] => {
  try {
    const parsed = JSON.parse(tagsJson || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const parseRulesOfEngagement = (rulesJson: string): string[] => {
  try {
    const parsed = JSON.parse(rulesJson || "[]");
    if (!Array.isArray(parsed)) return DEFAULT_RULES_OF_ENGAGEMENT;
    const rules = parsed.map(String).filter((r) => r.trim().length > 0);
    return rules.length > 0 ? rules : DEFAULT_RULES_OF_ENGAGEMENT;
  } catch {
    return DEFAULT_RULES_OF_ENGAGEMENT;
  }
};

const serializeRulesOfEngagement = (rules: string[]): string => {
  const cleaned = rules.map((r) => r.trim()).filter((r) => r.length > 0);
  return JSON.stringify(cleaned.length > 0 ? cleaned : DEFAULT_RULES_OF_ENGAGEMENT);
};

const normalizeDifficulty = (value?: string): ContestDifficulty => {
  const upper = (value || "MEDIUM").toUpperCase();
  if (upper === "EASY" || upper === "HARD") return upper;
  return "MEDIUM";
};

const scheduledEndTime = (
  start: Date | null | undefined,
  durationMinutes: number,
): Date | null => {
  if (!start) return null;
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
};

const contestListInclude = {
  problems: { select: { id: true } },
  participants: {
    select: {
      id: true,
      userId: true,
      finished: true,
      solvedCount: true,
      rank: true,
      submissions: {
        select: {
          contestProblemId: true,
          verdict: true,
        },
      },
    },
  },
} as const;

type ContestListRow = Awaited<
  ReturnType<typeof prisma.contest.findMany<{ include: typeof contestListInclude }>>
>[number];

const mapContestToSummary = (
  contest: ContestListRow,
  userId?: string,
): ContestSummary => {
  const start = contest.scheduledStartTime ?? contest.virtualStartTime;
  const activeParticipantCount =
    contest.status === "ONGOING"
      ? contest.participants.filter((p) => !p.finished).length
      : 0;

  let myProgress: ContestSummary["myProgress"];
  if (userId) {
    const participant = contest.participants.find((p) => p.userId === userId);
    if (participant) {
      const solvedProblemIds = new Set<string>();
      for (const sub of participant.submissions) {
        if (ACCEPTED_VERDICTS.includes((sub.verdict || "").trim())) {
          solvedProblemIds.add(sub.contestProblemId);
        }
      }
      myProgress = {
        solvedCount: solvedProblemIds.size || participant.solvedCount,
        totalProblems: contest.problems.length,
        rank: participant.rank,
        isParticipant: true,
      };
    }
  }

  return {
    id: contest.id,
    title: contest.title,
    description: contest.description,
    type: contest.type,
    status: contest.status,
    difficulty: normalizeDifficulty(contest.difficulty),
    durationMinutes: contest.durationMinutes,
    scheduledStartTime: contest.scheduledStartTime,
    scheduledEndTime: scheduledEndTime(start, contest.durationMinutes),
    freezeEnabled: contest.freezeEnabled,
    freezeMinutes: contest.freezeMinutes,
    virtualStartTime: contest.virtualStartTime,
    rulesOfEngagement: parseRulesOfEngagement(contest.rulesOfEngagement),
    createdAt: contest.createdAt,
    problemCount: contest.problems.length,
    participantCount: contest.participants.length,
    activeParticipantCount,
    myProgress,
  };
};

export const syncContestLifecycleInDB = async (contestId?: string): Promise<void> => {
  const now = new Date();
  const where = contestId
    ? { id: contestId, status: { in: ["SCHEDULED", "ONGOING"] as ContestStatusValue[] } }
    : { status: { in: ["SCHEDULED", "ONGOING"] as ContestStatusValue[] } };

  const contests = await prisma.contest.findMany({ where });

  for (const contest of contests) {
    const start = contest.scheduledStartTime ?? contest.virtualStartTime;
    const end = scheduledEndTime(start, contest.durationMinutes);

    if (contest.status === "SCHEDULED" && start && now >= start) {
      await prisma.contest.update({
        where: { id: contest.id },
        data: { status: "ONGOING", virtualStartTime: start },
      });
      continue;
    }

    if (contest.status === "ONGOING" && end && now >= end) {
      await persistScoreboardRanksInDB(contest.id);
      await prisma.contest.update({
        where: { id: contest.id },
        data: { status: "COMPLETED" },
      });
    }
  }
};

const codePathProblemSelect = {
  id: true,
  slug: true,
  title: true,
  rating: true,
  tags: true,
} as const;

export const createContestInDB = async (data: {
  title: string;
  description?: string;
  difficulty?: string;
  durationMinutes: number;
  scheduledStartTime?: Date | null;
  freezeEnabled: boolean;
  freezeMinutes?: number | null;
  rulesOfEngagement?: string[];
  createdByUserId: string;
  problems: Array<{
    codePathProblemId: string;
    label: string;
    order: number;
  }>;
}) => {
  return prisma.contest.create({
    data: {
      title: data.title,
      description: data.description,
      difficulty: normalizeDifficulty(data.difficulty),
      durationMinutes: data.durationMinutes,
      scheduledStartTime: data.scheduledStartTime ?? null,
      freezeEnabled: data.freezeEnabled,
      freezeMinutes: data.freezeMinutes,
      rulesOfEngagement: serializeRulesOfEngagement(
        data.rulesOfEngagement ?? DEFAULT_RULES_OF_ENGAGEMENT,
      ),
      createdByUserId: data.createdByUserId,
      problems: { create: data.problems },
    },
    include: {
      problems: {
        include: { codePathProblem: { select: codePathProblemSelect } },
        orderBy: { order: "asc" },
      },
    },
  });
};

export const getContestsFromDB = async (
  status?: string,
  options?: { excludeDraft?: boolean; userId?: string },
): Promise<ContestSummary[]> => {
  await syncContestLifecycleInDB();

  const where: { status?: ContestStatusValue | { not: ContestStatusValue } } = {};
  if (status) {
    where.status = status as ContestStatusValue;
  } else if (options?.excludeDraft) {
    where.status = { not: "DRAFT" };
  }

  const contests = await prisma.contest.findMany({
    where,
    include: contestListInclude,
    orderBy: [{ scheduledStartTime: "asc" }, { createdAt: "desc" }],
  });

  const summaries = contests.map((contest) => mapContestToSummary(contest, options?.userId));
  return enrichContestsWithUserProgress(summaries, options?.userId);
};

export const getMyContestsFromDB = async (userId: string): Promise<ContestSummary[]> => {
  await syncContestLifecycleInDB();

  const contests = await prisma.contest.findMany({
    where: { participants: { some: { userId } } },
    include: contestListInclude,
    orderBy: [{ scheduledStartTime: "asc" }, { createdAt: "desc" }],
  });

  const summaries = contests.map((contest) => mapContestToSummary(contest, userId));
  return enrichContestsWithUserProgress(summaries, userId);
};

export const getContestByIdFromDB = async (id: string) => {
  return prisma.contest.findUnique({
    where: { id },
    include: {
      problems: {
        include: { codePathProblem: { select: codePathProblemSelect } },
        orderBy: { order: "asc" },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profile: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });
};

export const updateContestInDB = async (
  id: string,
  data: {
    title?: string;
    description?: string | null;
    difficulty?: string;
    durationMinutes?: number;
    scheduledStartTime?: Date | null;
    freezeEnabled?: boolean;
    freezeMinutes?: number | null;
    rulesOfEngagement?: string[];
    problems?: Array<{
      codePathProblemId: string;
      label: string;
      order: number;
    }>;
  },
) => {
  if (data.problems) {
    await prisma.contestProblem.deleteMany({ where: { contestId: id } });
  }

  return prisma.contest.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.difficulty !== undefined
        ? { difficulty: normalizeDifficulty(data.difficulty) }
        : {}),
      ...(data.durationMinutes !== undefined
        ? { durationMinutes: data.durationMinutes }
        : {}),
      ...(data.scheduledStartTime !== undefined
        ? { scheduledStartTime: data.scheduledStartTime }
        : {}),
      ...(data.freezeEnabled !== undefined ? { freezeEnabled: data.freezeEnabled } : {}),
      ...(data.freezeMinutes !== undefined ? { freezeMinutes: data.freezeMinutes } : {}),
      ...(data.rulesOfEngagement !== undefined
        ? { rulesOfEngagement: serializeRulesOfEngagement(data.rulesOfEngagement) }
        : {}),
      ...(data.problems
        ? { problems: { create: data.problems } }
        : {}),
    },
    include: {
      problems: {
        include: { codePathProblem: { select: codePathProblemSelect } },
        orderBy: { order: "asc" },
      },
    },
  });
};

export const updateContestStatusInDB = async (
  id: string,
  status: ContestStatusValue,
  virtualStartTime?: Date,
) => {
  return prisma.contest.update({
    where: { id },
    data: {
      status,
      ...(virtualStartTime ? { virtualStartTime } : {}),
    },
  });
};

export const deleteContestFromDB = async (id: string) => {
  await prisma.contestProblem.deleteMany({ where: { contestId: id } });
  await prisma.contestParticipant.deleteMany({ where: { contestId: id } });
  await prisma.contestSubmission.deleteMany({ where: { contestId: id } });
  await prisma.contest.delete({ where: { id } });
};

export const findParticipantInDB = async (contestId: string, userId: string) => {
  return prisma.contestParticipant.findUnique({
    where: { contestId_userId: { contestId, userId } },
  });
};

export const addParticipantInDB = async (
  contestId: string,
  userId: string,
  virtualStartTime: Date,
  options?: { isVirtualReplay?: boolean },
) => {
  return prisma.contestParticipant.create({
    data: {
      contestId,
      userId,
      virtualStartTime,
      isVirtualReplay: options?.isVirtualReplay ?? false,
      penalty: 0,
      solvedCount: 0,
      finished: false,
    },
  });
};

export const startVirtualContestInDB = async (contestId: string, userId: string) => {
  const existing = await findParticipantInDB(contestId, userId);

  if (existing) {
    await prisma.contestSubmission.deleteMany({ where: { participantId: existing.id } });
    return prisma.contestParticipant.update({
      where: { id: existing.id },
      data: {
        virtualStartTime: new Date(),
        isVirtualReplay: true,
        finished: false,
        solvedCount: 0,
        penalty: 0,
      },
    });
  }

  return addParticipantInDB(contestId, userId, new Date(), { isVirtualReplay: true });
};

export const getContestProblemById = async (id: string) => {
  return prisma.contestProblem.findUnique({
    where: { id },
    include: {
      codePathProblem: {
        include: {
          testCases: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
};

export const getContestProblemsForContest = async (contestId: string) => {
  return prisma.contestProblem.findMany({
    where: { contestId },
    include: { codePathProblem: { select: codePathProblemSelect } },
    orderBy: { order: "asc" },
  });
};

export const getParticipantSubmissions = async (
  contestId: string,
  participantId: string,
) => {
  return prisma.contestSubmission.findMany({
    where: { contestId, participantId },
    include: {
      contestProblem: {
        select: { id: true, label: true, codePathProblemId: true },
      },
    },
    orderBy: { submissionTimeMinutes: "asc" },
  });
};

export const addContestSubmissionInDB = async (data: {
  contestId: string;
  participantId: string;
  contestProblemId: string;
  codePathSubmissionId: string;
  verdict: string;
  submissionTimeMinutes: number;
  programmingLanguage: string;
}) => {
  return prisma.contestSubmission.create({ data });
};

export const markParticipantFinishedInDB = async (participantId: string) => {
  return prisma.contestParticipant.update({
    where: { id: participantId },
    data: { finished: true },
  });
};

export const verifyPublishedCodePathProblemsInDB = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)];
  const found = await prisma.codePathProblem.findMany({
    where: { id: { in: uniqueIds }, status: "PUBLISHED" },
    select: { id: true },
  });
  const foundIds = new Set(found.map((p) => p.id));
  return uniqueIds.filter((id) => !foundIds.has(id));
};

const skillTierRatingRange = (tier: string): { min: number; max: number } => {
  switch (tier.toLowerCase()) {
    case "beginner":
      return { min: 800, max: 1200 };
    case "advanced":
      return { min: 1600, max: 2600 };
    default:
      return { min: 1200, max: 1600 };
  }
};

export const pickCodePathProblemsForSelectionInDB = async (params: {
  targetSkillTier: string;
  topics: Array<{ title: string }>;
  totalProblems: number;
}): Promise<string[]> => {
  const { min, max } = skillTierRatingRange(params.targetSkillTier);
  const keywords = params.topics.flatMap((t) =>
    t.title
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 1),
  );

  const pool = await prisma.codePathProblem.findMany({
    where: { status: "PUBLISHED", rating: { gte: min, lte: max } },
    select: { id: true, tags: true, rating: true },
    take: 80,
  });

  const scored = pool
    .map((p) => {
      const tags = parseTags(p.tags);
      const score = tags.reduce(
        (sum, tag) =>
          sum +
          keywords.reduce(
            (k, kw) =>
              k + (tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase()) ? 1 : 0),
            0,
          ),
        0,
      );
      const mid = (min + max) / 2;
      return { id: p.id, score, distance: Math.abs(p.rating - mid) };
    })
    .sort((a, b) => b.score - a.score || a.distance - b.distance);

  const picked = scored.slice(0, params.totalProblems).map((p) => p.id);

  if (picked.length < params.totalProblems) {
    const fallback = await prisma.codePathProblem.findMany({
      where: {
        status: "PUBLISHED",
        id: { notIn: picked },
        rating: { gte: 800, lte: 2600 },
      },
      orderBy: { rating: "asc" },
      take: params.totalProblems - picked.length,
      select: { id: true },
    });
    picked.push(...fallback.map((p) => p.id));
  }

  return picked.slice(0, params.totalProblems);
};

const matchScoreForCodePathProblem = (
  codePathProblem: { id: string; tags: string; rating: number },
  targetRating: number,
  targetTags: string[],
  used: Set<string>,
): number => {
  if (used.has(codePathProblem.id)) return -1;
  const tags = parseTags(codePathProblem.tags);
  const tagOverlap = targetTags.reduce(
    (sum, tag) =>
      sum +
      tags.reduce(
        (inner, t) =>
          inner +
          (t.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(t.toLowerCase())
            ? 1
            : 0),
        0,
      ),
    0,
  );
  const ratingDistance = Math.abs(codePathProblem.rating - targetRating);
  return tagOverlap * 10 - ratingDistance;
};

export const pickCodePathProblemsFromAISelectionInDB = async (params: {
  userId: string;
  targetSkillTier: string;
  topics: Array<{ id?: number; title: string }>;
  totalProblems: number;
}): Promise<string[]> => {
  const topics =
    params.topics.length > 0
      ? params.topics
      : [{ title: "implementation" }, { title: "math" }];

  const [quizPerformance, codeforcesStats] = await Promise.all([
    getUserQuizPerformanceFromDB(params.userId),
    getUserCodeforcesStatsFromDB(params.userId),
  ]);

  const aiResponse = await selectContestProblems({
    userId: params.userId,
    targetSkillTier: params.targetSkillTier,
    topics: topics.map((t) => ({ id: t.id ?? null, title: t.title })),
    quizPerformance,
    codeforcesStats,
    totalProblems: params.totalProblems,
  });

  const pool = await prisma.codePathProblem.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, tags: true, rating: true },
  });

  const used = new Set<string>();
  const picked: string[] = [];

  for (const aiProblem of aiResponse.problems ?? []) {
    const scored = pool
      .map((p) => ({
        id: p.id,
        score: matchScoreForCodePathProblem(p, aiProblem.rating, aiProblem.tags ?? [], used),
      }))
      .filter((p) => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored[0]) {
      picked.push(scored[0].id);
      used.add(scored[0].id);
    }
  }

  if (picked.length < params.totalProblems) {
    const fallback = await pickCodePathProblemsForSelectionInDB({
      targetSkillTier: params.targetSkillTier,
      topics,
      totalProblems: params.totalProblems - picked.length,
    });
    for (const id of fallback) {
      if (!used.has(id)) {
        picked.push(id);
        used.add(id);
      }
    }
  }

  return picked.slice(0, params.totalProblems);
};

interface StandingResult {
  solvedCount: number;
  penalty: number;
  problems: ScoreboardProblemCell[];
}

const computeStanding = (
  problems: Array<{ id: string; label: string }>,
  submissions: Array<{
    contestProblemId: string;
    verdict: string;
    submissionTimeMinutes: number;
  }>,
): StandingResult => {
  const acceptedFirst = new Map<string, number>();
  const wrongAttempts = new Map<string, number>();

  for (const sub of submissions) {
    const problemId = sub.contestProblemId;
    const verdict = (sub.verdict || "").trim();
    if (IGNORED_VERDICTS.includes(verdict)) continue;

    if (ACCEPTED_VERDICTS.includes(verdict)) {
      if (!acceptedFirst.has(problemId)) {
        acceptedFirst.set(problemId, sub.submissionTimeMinutes);
      }
    } else {
      const alreadySolved = acceptedFirst.has(problemId);
      if (!alreadySolved) {
        wrongAttempts.set(problemId, (wrongAttempts.get(problemId) ?? 0) + 1);
      }
    }
  }

  let solvedCount = 0;
  let penalty = 0;
  const cells: ScoreboardProblemCell[] = problems.map(
    (problem): ScoreboardProblemCell => {
      const solveTime = acceptedFirst.get(problem.id);
      const wrong = wrongAttempts.get(problem.id) ?? 0;
      if (solveTime !== undefined) {
        solvedCount += 1;
        penalty += solveTime + 20 * wrong;
        return { label: problem.label, accepted: true, timeMinutes: solveTime, wrongAttempts: wrong };
      }
      return { label: problem.label, accepted: false, timeMinutes: null, wrongAttempts: wrong };
    },
  );

  return { solvedCount, penalty, problems: cells };
};

export const getScoreboardFromDB = async (
  contestId: string,
  options?: { final?: boolean },
): Promise<ScoreboardRow[]> => {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      problems: { select: { id: true, label: true, order: true }, orderBy: { order: "asc" } },
      participants: {
        include: {
          user: { select: { id: true, username: true, profile: { select: { fullName: true } } } },
          submissions: {
            select: {
              contestProblemId: true,
              verdict: true,
              submissionTimeMinutes: true,
            },
            orderBy: { submissionTimeMinutes: "asc" },
          },
        },
      },
    },
  });

  if (!contest) return [];

  const liveParticipants = contest.participants.filter((p) => !p.isVirtualReplay);

  if (contest.status === "COMPLETED") {
    const ranked = liveParticipants
      .filter((p) => p.rank != null)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

    return ranked.map((participant) => {
      const standing = computeStanding(contest.problems, participant.submissions);
      return {
        rank: participant.rank ?? 0,
        participantId: participant.id,
        userId: participant.userId,
        username: participant.user.username,
        fullName: participant.user.profile?.fullName ?? null,
        solvedCount: participant.solvedCount,
        penalty: participant.penalty,
        problems: standing.problems,
      };
    });
  }

  const freezePointMinutes =
    !options?.final && contest.freezeEnabled && contest.freezeMinutes != null
      ? Math.max(0, contest.durationMinutes - contest.freezeMinutes)
      : null;

  const rows: ScoreboardRow[] = liveParticipants.map((participant) => {
    let submissions = participant.submissions;
    if (freezePointMinutes != null) {
      submissions = submissions.filter(
        (s) => s.submissionTimeMinutes <= freezePointMinutes,
      );
    }
    const standing = computeStanding(contest.problems, submissions);
    return {
      rank: 0,
      participantId: participant.id,
      userId: participant.userId,
      username: participant.user.username,
      fullName: participant.user.profile?.fullName ?? null,
      solvedCount: standing.solvedCount,
      penalty: standing.penalty,
      problems: standing.problems,
    };
  });

  rows.sort((a, b) => {
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    return a.penalty - b.penalty;
  });

  rows.forEach((row, index) => {
    if (index === 0) {
      row.rank = 1;
      return;
    }
    const prev = rows[index - 1];
    if (row.solvedCount === prev.solvedCount && row.penalty === prev.penalty) {
      row.rank = prev.rank;
    } else {
      row.rank = index + 1;
    }
  });

  return rows;
};

const getParticipantRankInDB = async (
  contestId: string,
  participantId: string,
): Promise<number | null> => {
  const rows = await getScoreboardFromDB(contestId);
  const row = rows.find((r) => r.participantId === participantId);
  return row?.rank ?? null;
};

const enrichContestsWithUserProgress = async (
  contests: ContestSummary[],
  userId?: string,
): Promise<ContestSummary[]> => {
  if (!userId) return contests;

  return Promise.all(
    contests.map(async (contest) => {
      if (!contest.myProgress?.isParticipant || contest.status !== "ONGOING") {
        return contest;
      }

      const participant = await prisma.contestParticipant.findUnique({
        where: { contestId_userId: { contestId: contest.id, userId } },
        select: { id: true },
      });
      if (!participant) return contest;

      const rank = await getParticipantRankInDB(contest.id, participant.id);
      return {
        ...contest,
        myProgress: {
          ...contest.myProgress!,
          rank,
        },
      };
    }),
  );
};

export const persistScoreboardRanksInDB = async (contestId: string) => {
  const rows = await getScoreboardFromDB(contestId, { final: true });
  await Promise.all(
    rows.map((row) =>
      prisma.contestParticipant.update({
        where: { id: row.participantId },
        data: { rank: row.rank, solvedCount: row.solvedCount, penalty: row.penalty },
      }),
    ),
  );
};

export { parseTags };
