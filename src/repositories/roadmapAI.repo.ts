import { prisma } from "../lib/prisma";
import { getMenteeCodePrint } from "./statistics.repo";
import { getMenteeSkillProfile } from "../services/assessment.service";
import { getCodePathSkillSourceFromDB } from "./assessment.repo";

export const getUserTopicsFromDB = async () => {
  return prisma.topic.findMany({
    select: { id: true, title: true, tags: true, rating: true },
    orderBy: { id: "asc" },
  });
};

export const getUserSkillAssessmentsFromDB = async (userId: string) => {
  return prisma.userSkillAssessment.findMany({
    where: { userId },
    select: {
      assessmentType: true,
      score: true,
      skillLevelId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getLatestSkillLevelIdFromDB = async (userId: string) => {
  const profile = await getMenteeSkillProfile(userId);
  if (profile.skillLevelId != null) return profile.skillLevelId;

  const assessment = await prisma.userSkillAssessment.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { skillLevelId: true },
  });
  if (assessment) return assessment.skillLevelId;

  const fallback = await prisma.skillLevel.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return fallback?.id ?? null;
};

interface TopicPerformance {
  topic: string;
  attempts: number;
  solved: number;
  accuracy: number;
}

/**
 * Attribute the user's Codeforces attempts to the platform's topics using the
 * problem tags from the local problemset (no external network calls).
 */
export const getUserQuizPerformanceFromDB = async (
  userId: string,
): Promise<TopicPerformance[]> => {
  const [cfPerformance, codepathSource] = await Promise.all([
    getUserQuizPerformanceFromAttempts(userId),
    getCodePathSkillSourceFromDB(userId),
  ]);

  const merged = new Map<string, TopicPerformance>();
  for (const item of cfPerformance) {
    merged.set(item.topic, item);
  }
  for (const item of codepathSource.topicPerformance) {
    const existing = merged.get(item.topic);
    if (existing) {
      const attempts = existing.attempts + item.attempts;
      const solved = existing.solved + item.solved;
      merged.set(item.topic, {
        topic: item.topic,
        attempts,
        solved,
        accuracy: attempts > 0 ? Math.round((solved / attempts) * 100) : 0,
      });
    } else {
      merged.set(item.topic, {
        topic: item.topic,
        attempts: item.attempts,
        solved: item.solved,
        accuracy: item.accuracy,
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.attempts - a.attempts);
};

async function getUserQuizPerformanceFromAttempts(
  userId: string,
): Promise<TopicPerformance[]> {
  const topics = await prisma.topic.findMany({
    select: { id: true, title: true, tags: true },
  });

  const attempts = await prisma.userProblemAttempt.findMany({
    where: { userId },
    select: { externalProblemId: true, solved: true, attemptCount: true },
  });
  if (attempts.length === 0 || topics.length === 0) return [];

  const problemIds = attempts.map((a) => a.externalProblemId);
  const problems = await prisma.problem.findMany({
    where: { externalProblemId: { in: problemIds } },
    select: { externalProblemId: true, tags: true },
  });

  const tagsByProblem = new Map<string, string[]>();
  for (const problem of problems) {
    try {
      tagsByProblem.set(
        problem.externalProblemId,
        JSON.parse(problem.tags || "[]") as string[],
      );
    } catch {
      tagsByProblem.set(problem.externalProblemId, []);
    }
  }

  const keywordsByTopic = topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    keywords: topic.title
      .toLowerCase()
      .split(/\s+/)
      .concat((topic.tags || "").split(",").map((t) => t.trim().toLowerCase()))
      .filter((k) => k.length > 0),
  }));

  const stats = new Map<number, { attempts: number; solved: number }>();

  const attribute = (tags: string[], attempt: { solved: boolean; attemptCount: number }) => {
    for (const keyword of tags) {
      for (const topic of keywordsByTopic) {
        const matches = topic.keywords.some(
          (kw) => kw === keyword || kw.includes(keyword) || keyword.includes(kw),
        );
        if (matches) {
          const entry = stats.get(topic.id) ?? { attempts: 0, solved: 0 };
          entry.attempts += Math.max(1, attempt.attemptCount);
          if (attempt.solved) entry.solved += 1;
          stats.set(topic.id, entry);
          break;
        }
      }
    }
  };

  for (const attempt of attempts) {
    const tags = tagsByProblem.get(attempt.externalProblemId);
    if (tags && tags.length > 0) attribute(tags, attempt);
  }

  return Array.from(stats.entries())
    .map(([topicId, entry]) => {
      const topic = topics.find((t) => t.id === topicId)!;
      return {
        topic: topic.title,
        attempts: entry.attempts,
        solved: entry.solved,
        accuracy: Math.round((entry.solved / entry.attempts) * 100),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
};

/**
 * Codeforces stats for the FastAPI roadmap/contest services. All lookups have
 * DB fallbacks so this never throws when the network is unavailable.
 */
interface TopicBreakdownEntry {
  topic: string;
  attempts: number;
  solved: number;
  total: number | null;
  accuracy: number | null;
}

export const getUserCodeforcesStatsFromDB = async (userId: string) => {
  const profile = await getMenteeSkillProfile(userId);
  const handle = profile.sources.codeforces.handle;
  const codePrint = await getMenteeCodePrint(userId);

  return {
    rating: profile.rating ?? 0,
    tier: profile.tier === "Not Assessed" ? "Beginner" : profile.tier,
    problemsSolved: profile.sources.codeforces.connected
      ? profile.sources.codeforces.problemsSolved
      : profile.sources.codepath.solvedCount,
    accuracy: profile.sources.codeforces.connected
      ? profile.sources.codeforces.accuracy
      : profile.sources.codepath.accuracy,
    topicBreakdown: codePrint.map((entry): TopicBreakdownEntry => ({
      topic: entry.topic,
      attempts: entry.attempts,
      solved: 0,
      total: null,
      accuracy: null,
    })),
    codeforcesHandle: handle,
  };
};

interface PersonalModule {
  order: number;
  topicId: number | null;
  topicTitle: string;
  learningObjective: string;
  estimatedHours: number;
  suggestedDifficultyRange: { min: number; max: number };
}

export const createPersonalRoadmapInDB = async (
  userId: string,
  targetSkillLevelId: number,
  modules: PersonalModule[],
) => {
  await prisma.userLearningProgress.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });

  const learningPath = await prisma.learningPath.create({
    data: {
      targetSkillLevelId,
      ownerUserId: userId,
      title: "My AI Roadmap",
      description: "Personalised roadmap generated for your weaker topics.",
    },
  });

  const createdModules: Array<{
    id: number;
    order: number;
    topicTitle: string;
    topicId: number | null;
    suggestedDifficultyRange: { min: number; max: number };
  }> = [];
  for (const module of modules) {
    const pathModule = await prisma.pathModule.create({
      data: {
        learningPathId: learningPath.id,
        topicId: module.topicId ?? null,
        moduleOrder: module.order,
        title: module.topicTitle,
        description: module.learningObjective,
        estimatedHours: module.estimatedHours,
        learningObjectives: {
          objective: module.learningObjective,
          suggestedDifficultyRange: module.suggestedDifficultyRange,
        },
      },
    });
    createdModules.push({
      id: pathModule.id,
      order: module.order,
      topicTitle: module.topicTitle,
      topicId: module.topicId ?? null,
      suggestedDifficultyRange: module.suggestedDifficultyRange,
    });
  }

  const progress = await prisma.userLearningProgress.create({
    data: {
      userId,
      learningPathId: learningPath.id,
      currentModuleId: createdModules.length > 0 ? createdModules[0].id : null,
      progressPercentage: 0,
      isActive: true,
    },
  });

  return { learningPath, createdModules, progress };
};

export const attachProblemsToPersonalModulesInDB = async (
  modules: Array<{
    id: number;
    topicId: number | null;
    topicTitle: string;
    suggestedDifficultyRange: { min: number; max: number };
  }>,
) => {
  for (const module of modules) {
    const { min, max } = module.suggestedDifficultyRange;
    const keywords = module.topicTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 1);

    const candidates = await prisma.problem.findMany({
      where: { rating: { gte: min, lte: max } },
      select: { externalProblemId: true, tags: true, rating: true },
      take: 12,
    });

    const scored = candidates
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
            keywords.reduce((s, kw) => s + (tag.includes(kw) || kw.includes(tag) ? 1 : 0), 0),
          0,
        );
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score || a.rating - b.rating)
      .slice(0, 3);

    if (scored.length === 0) {
      const cpCandidates = await prisma.codePathProblem.findMany({
        where: {
          status: "PUBLISHED",
          rating: { gte: min, lte: max },
        },
        select: { id: true, tags: true, rating: true },
        take: 12,
      });

      const cpScored = cpCandidates
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
                (s, kw) => s + (tag.includes(kw) || kw.includes(tag) ? 1 : 0),
                0,
              ),
            0,
          );
          return { ...p, score };
        })
        .sort((a, b) => b.score - a.score || a.rating - b.rating)
        .slice(0, 3);

      if (cpScored.length > 0) {
        await prisma.moduleProblem.createMany({
          data: cpScored.map((p) => ({
            pathModuleId: module.id,
            externalProblemId: p.id,
            platform: "CodePath",
          })),
          skipDuplicates: true,
        });
      }
      continue;
    }

    await prisma.moduleProblem.createMany({
      data: scored.map((p) => ({
        pathModuleId: module.id,
        externalProblemId: p.externalProblemId,
        platform: "Codeforces",
      })),
      skipDuplicates: true,
    });

    const cpCandidates = await prisma.codePathProblem.findMany({
      where: { status: "PUBLISHED", rating: { gte: min, lte: max } },
      select: { id: true, tags: true, rating: true },
      take: 8,
    });
    const cpScored = cpCandidates
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
              (s, kw) => s + (tag.includes(kw) || kw.includes(tag) ? 1 : 0),
              0,
            ),
          0,
        );
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score || a.rating - b.rating)
      .slice(0, 2);

    if (cpScored.length > 0) {
      await prisma.moduleProblem.createMany({
        data: cpScored.map((p) => ({
          pathModuleId: module.id,
          externalProblemId: p.id,
          platform: "CodePath",
        })),
        skipDuplicates: true,
      });
    }
  }
};
