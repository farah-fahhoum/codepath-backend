import { prisma } from "../lib/prisma";
import {
  ContestStatusValue,
  ContestSummary,
  ScoreboardProblemCell,
  ScoreboardRow,
} from "../types/contest.type";

const ACCEPTED_VERDICTS = ["AC", "Accepted", "OK"];
const IGNORED_VERDICTS = ["CE", "Compilation Error", "SKIPPED", "TESTING", ""];

export const problemLabelForIndex = (index: number): string => {
  return String.fromCharCode(65 + index);
};

export const createContestInDB = async (data: {
  title: string;
  description?: string;
  durationMinutes: number;
  freezeEnabled: boolean;
  freezeMinutes?: number | null;
  createdByUserId: string;
  problems: Array<{
    problemId: number;
    label: string;
    order: number;
    topicId?: number | null;
  }>;
}) => {
  return prisma.contest.create({
    data: {
      title: data.title,
      description: data.description,
      durationMinutes: data.durationMinutes,
      freezeEnabled: data.freezeEnabled,
      freezeMinutes: data.freezeMinutes,
      createdByUserId: data.createdByUserId,
      problems: { create: data.problems },
    },
    include: {
      problems: {
        include: {
          problem: true,
          topic: { select: { id: true, title: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
};

const contestListInclude = {
  problems: { select: { id: true } },
  participants: { select: { id: true } },
} as const;

export const getContestsFromDB = async (status?: string): Promise<ContestSummary[]> => {
  const contests = await prisma.contest.findMany({
    where: status ? { status: status as ContestStatusValue } : {},
    include: contestListInclude,
    orderBy: { createdAt: "desc" },
  });

  return contests.map((contest: any) => ({
    id: contest.id,
    title: contest.title,
    description: contest.description,
    type: contest.type,
    status: contest.status,
    durationMinutes: contest.durationMinutes,
    freezeEnabled: contest.freezeEnabled,
    freezeMinutes: contest.freezeMinutes,
    virtualStartTime: contest.virtualStartTime,
    createdAt: contest.createdAt,
    problemCount: contest.problems.length,
    participantCount: contest.participants.length,
  }));
};

export const getMyContestsFromDB = async (userId: string): Promise<ContestSummary[]> => {
  const contests = await prisma.contest.findMany({
    where: { participants: { some: { userId } } },
    include: contestListInclude,
    orderBy: { createdAt: "desc" },
  });

  return contests.map((contest: any) => ({
    id: contest.id,
    title: contest.title,
    description: contest.description,
    type: contest.type,
    status: contest.status,
    durationMinutes: contest.durationMinutes,
    freezeEnabled: contest.freezeEnabled,
    freezeMinutes: contest.freezeMinutes,
    virtualStartTime: contest.virtualStartTime,
    createdAt: contest.createdAt,
    problemCount: contest.problems.length,
    participantCount: contest.participants.length,
  }));
};

export const getContestByIdFromDB = async (id: string) => {
  return prisma.contest.findUnique({
    where: { id },
    include: {
      problems: {
        include: {
          problem: true,
          topic: { select: { id: true, title: true } },
        },
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
) => {
  return prisma.contestParticipant.create({
    data: {
      contestId,
      userId,
      virtualStartTime,
      penalty: 0,
      solvedCount: 0,
      finished: false,
    },
  });
};

export const getContestProblemById = async (id: string) => {
  return prisma.contestProblem.findUnique({
    where: { id },
    include: { problem: true, topic: { select: { id: true, title: true } } },
  });
};

export const getContestProblemsForContest = async (contestId: string) => {
  return prisma.contestProblem.findMany({
    where: { contestId },
    include: { problem: true },
    orderBy: { order: "asc" },
  });
};

export const getParticipantSubmissions = async (
  contestId: string,
  participantId: string,
) => {
  return prisma.contestSubmission.findMany({
    where: { contestId, participantId },
    orderBy: { submissionTimeMinutes: "asc" },
  });
};

export const addContestSubmissionInDB = async (data: {
  contestId: string;
  participantId: string;
  contestProblemId: string;
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

export const pickProblemsForCriteriaInDB = async (
  criteria: Array<{
    topicId: number | null;
    topicTitle: string;
    suggestedDifficulty: number;
    count: number;
  }>,
): Promise<Array<{ problemId: number; topicId: number | null }>> => {
  const results: Array<{ problemId: number; topicId: number | null }> = [];

  for (const criterion of criteria) {
    if (criterion.count <= 0) continue;

    const min = Math.max(400, criterion.suggestedDifficulty - 150);
    const max = criterion.suggestedDifficulty + 150;
    const keywords = criterion.topicTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 1);

    const pool = await prisma.problem.findMany({
      where: { rating: { gte: min, lte: max } },
      select: { id: true, tags: true, rating: true },
      take: 40,
    });

    const scored = pool
      .map((p) => {
        let tags: string[] = [];
        try {
          tags = JSON.parse(p.tags || "[]") as string[];
        } catch {
          tags = [];
        }
        const score = tags.reduce(
          (sum, tag) =>
            sum +
            keywords.reduce(
              (k, kw) => k + (tag.includes(kw) || kw.includes(tag) ? 1 : 0),
              0,
            ),
          0,
        );
        return {
          id: p.id,
          rating: p.rating,
          score,
          distance: Math.abs(p.rating - criterion.suggestedDifficulty),
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score || a.distance - b.distance || a.rating - b.rating,
      );

    const picked = scored.slice(0, criterion.count);
    for (const p of picked) {
      results.push({ problemId: p.id, topicId: criterion.topicId });
    }

    if (picked.length < criterion.count) {
      const fallback = await prisma.problem.findMany({
        where: { rating: { gte: 800, lte: 2600 } },
        orderBy: { rating: "asc" },
        take: criterion.count - picked.length,
        select: { id: true },
      });
      for (const p of fallback) {
        results.push({ problemId: p.id, topicId: criterion.topicId });
      }
    }
  }

  return results;
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

  // Freeze cutoff in contest-relative minutes. Submissions after the freeze
  // point are hidden from the public scoreboard.
  const freezePointMinutes =
    !options?.final && contest.freezeEnabled && contest.freezeMinutes != null
      ? Math.max(0, contest.durationMinutes - contest.freezeMinutes)
      : null;

  const rows: ScoreboardRow[] = contest.participants.map((participant: any) => {
    let submissions = participant.submissions;
    if (freezePointMinutes != null) {
      submissions = submissions.filter(
        (s: any) => s.submissionTimeMinutes <= freezePointMinutes,
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

export const persistScoreboardRanksInDB = async (contestId: string) => {
  const rows = await getScoreboardFromDB(contestId, { final: true });
  await Promise.all(
    rows.map((row) =>
      prisma.contestParticipant.update({
        where: { id: row.participantId },
        data: { rank: row.rank },
      }),
    ),
  );
};
