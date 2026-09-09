import { prisma } from "../lib/prisma";
import { tierFromRating } from "../lib/skillTier";

const SKILL_TIER_ORDER = [
  "Not Assessed",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
  "Master",
] as const;

function tierRank(tier: string): number {
  const index = SKILL_TIER_ORDER.indexOf(tier as (typeof SKILL_TIER_ORDER)[number]);
  return index === -1 ? 0 : index;
}
import type { MenteeSkillProfileSources } from "../types/assessment.type";
import {
  Roadmap,
  RoadmapWithModules,
  PathModule,
  ModuleResource,
  ModuleProblem,
  Topic,
} from "../types/roadmap.type";

export const getActiveUserLearningProgressFromDB = async (userId: string) => {
  return prisma.userLearningProgress.findFirst({
    where: {
      userId,
      isActive: true,
    },
    include: {
      learningPath: {
        include: {
          skillLevel: {
            select: { title: true },
          },
          pathModules: true,
        },
      },
      currentModule: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

function computeActiveStreakDays(activityDates: Date[]): number {
  if (activityDates.length === 0) return 0;

  const dayKeys = new Set(
    activityDates.map((date) => date.toISOString().slice(0, 10)),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dayKeys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function proficiencyFromCompletion(completionPercentage: number): string {
  if (completionPercentage >= 90) return "Advanced";
  if (completionPercentage >= 50) return "Moderate";
  return "Beginner";
}

export const getUserRoadmapSummaryFromDB = async (userId: string) => {
  const focus = await getUserCurrentFocusFromDB(userId);
  if (!focus) return null;

  const totalModules = focus.modules.length;
  const modulesCompleted = focus.modules.filter((m) => m.isCompleted).length;
  const topicsMastered = modulesCompleted;
  const progressPercentage =
    totalModules > 0
      ? Math.round((modulesCompleted / totalModules) * 100)
      : 0;

  const [learningPath, attempts, skillSnapshot] = await Promise.all([
    prisma.learningPath.findUnique({
      where: { id: focus.learningPathId },
      select: { ownerUserId: true },
    }),
    prisma.userProblemAttempt.findMany({
      where: { userId },
      select: { solved: true, attemptCount: true, lastAttempt: true },
    }),
    prisma.userSkillSnapshot.findUnique({
      where: { userId },
      select: { sourcesJson: true },
    }),
  ]);

  const totalAttempts = attempts.reduce(
    (sum, attempt) => sum + attempt.attemptCount,
    0,
  );
  const solvedProblems = attempts.filter((attempt) => attempt.solved).length;
  let accuracy =
    attempts.length > 0
      ? Math.round((solvedProblems / attempts.length) * 100)
      : 0;

  if (skillSnapshot?.sourcesJson) {
    try {
      const sources = skillSnapshot.sourcesJson as {
        codepath?: { accuracy?: number };
        codeforces?: { accuracy?: number };
      };
      const codepathAccuracy = sources.codepath?.accuracy;
      const codeforcesAccuracy = sources.codeforces?.accuracy;
      if (codepathAccuracy != null && codeforcesAccuracy != null) {
        accuracy = Math.round((codepathAccuracy + codeforcesAccuracy) / 2);
      } else if (codepathAccuracy != null) {
        accuracy = Math.round(codepathAccuracy);
      } else if (codeforcesAccuracy != null) {
        accuracy = Math.round(codeforcesAccuracy);
      }
    } catch {
      // keep attempt-based fallback
    }
  }

  const activeStreak = computeActiveStreakDays(
    attempts.map((attempt) => attempt.lastAttempt),
  );

  return {
    learningPathId: focus.learningPathId,
    learningPathTitle: focus.learningPathTitle,
    progressPercentage,
    modulesCompleted,
    topicsMastered,
    totalModules,
    accuracy,
    activeStreak,
    isPersonalRoadmap: learningPath?.ownerUserId != null,
  };
};

/** Sync template roadmap to the user's assessed skill level (keeps personal AI roadmaps). */
export const activateRoadmapForUserSkillProfile = async (userId: string) => {
  let snapshot = await prisma.userSkillSnapshot.findUnique({
    where: { userId },
    select: { skillLevelId: true, tier: true, sourcesJson: true },
  });

  if (snapshot) {
    const sources = snapshot.sourcesJson as unknown as MenteeSkillProfileSources;
    const cfRating = sources.codeforces?.rating;
    const cfTier =
      cfRating != null ? tierFromRating(cfRating) : null;
    if (
      sources.codeforces?.connected &&
      cfTier != null &&
      tierRank(cfTier) > tierRank(snapshot.tier)
    ) {
      const { refreshSkillSnapshotFast } = await import(
        "../services/assessment.service"
      );
      await refreshSkillSnapshotFast(userId);
      snapshot = await prisma.userSkillSnapshot.findUnique({
        where: { userId },
        select: { skillLevelId: true, tier: true, sourcesJson: true },
      });
    }
  } else {
    const { refreshSkillSnapshotFast } = await import(
      "../services/assessment.service"
    );
    await refreshSkillSnapshotFast(userId);
    snapshot = await prisma.userSkillSnapshot.findUnique({
      where: { userId },
      select: { skillLevelId: true, tier: true, sourcesJson: true },
    });
  }

  if (!snapshot?.skillLevelId || snapshot.tier === "Not Assessed") {
    return null;
  }

  const active = await prisma.userLearningProgress.findFirst({
    where: { userId, isActive: true },
    include: {
      learningPath: { select: { ownerUserId: true, targetSkillLevelId: true } },
    },
  });

  if (active?.learningPath.ownerUserId != null) {
    return active;
  }

  if (
    active &&
    active.learningPath.targetSkillLevelId === snapshot.skillLevelId
  ) {
    return active;
  }

  return activateUserRoadmapForSkillLevelInDB(userId, snapshot.skillLevelId);
};

export const activateUserRoadmapForSkillLevelInDB = async (
  userId: string,
  skillLevelId: number,
) => {
  const learningPath = await prisma.learningPath.findFirst({
    where: {
      targetSkillLevelId: skillLevelId,
      ownerUserId: null,
    },
    include: {
      pathModules: {
        orderBy: {
          moduleOrder: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!learningPath) {
    return null;
  }

  const existingActive = await prisma.userLearningProgress.findFirst({
    where: {
      userId,
      isActive: true,
    },
  });

  if (existingActive && existingActive.learningPathId === learningPath.id) {
    return existingActive;
  }

  await prisma.userLearningProgress.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return prisma.userLearningProgress.create({
    data: {
      userId,
      learningPathId: learningPath.id,
      currentModuleId: learningPath.pathModules[0]
        ? learningPath.pathModules[0].id
        : null,
      progressPercentage: 0,
      isActive: true,
    },
  });
};

export const getUserCurrentFocusFromDB = async (userId: string) => {
  const progress = await prisma.userLearningProgress.findFirst({
    where: {
      userId,
      isActive: true,
    },
    include: {
      learningPath: {
        include: {
          pathModules: {
            include: {
              moduleProblems: true,
              topic: { select: { title: true } },
            },
            orderBy: {
              moduleOrder: "asc",
            },
          },
        },
      },
    },
  });

  if (!progress) {
    return null;
  }

  const attempts = await prisma.userProblemAttempt.findMany({
    where: { userId },
  });

  const attemptByKey = new Map(
    attempts.map((attempt) => [
      `${attempt.platform}:${attempt.externalProblemId}`,
      attempt,
    ]),
  );

  const modules = progress.learningPath.pathModules.map((module) => {
    const totalProblems = module.moduleProblems.length;
    let solvedProblems = 0;
    let wrongSubmissions = 0;
    let acceptedSolutions = 0;

    const problems = module.moduleProblems.map((problem) => {
      const key = `${problem.platform}:${problem.externalProblemId}`;
      const attempt = attemptByKey.get(key);
      const solved = attempt?.solved ?? false;

      if (solved) {
        solvedProblems += 1;
        acceptedSolutions += 1;
        if (attempt) {
          wrongSubmissions += Math.max(0, attempt.attemptCount - 1);
        }
      } else if (attempt) {
        wrongSubmissions += attempt.attemptCount;
      }

      return {
        externalProblemId: problem.externalProblemId,
        platform: problem.platform,
        solved,
      };
    });

    const completionPercentage =
      totalProblems === 0
        ? 0
        : Math.round((solvedProblems / totalProblems) * 100);

    const isCompleted = totalProblems > 0 && solvedProblems === totalProblems;
    const accuracy =
      totalProblems > 0
        ? Math.round((solvedProblems / totalProblems) * 100)
        : 0;

    return {
      id: module.id,
      title: module.title,
      topicTitle: module.topic?.title ?? module.title,
      moduleOrder: module.moduleOrder,
      totalProblems,
      solvedProblems,
      completionPercentage,
      isCompleted,
      accuracy,
      proficiency: proficiencyFromCompletion(completionPercentage),
      performance: {
        roadmapProblems: totalProblems,
        generalProblems: 0,
        wrongSubmissions,
        acceptedSolutions,
      },
      problems,
    };
  });

  const currentModule =
    modules.find((m) => !m.isCompleted) || modules[modules.length - 1] || null;

  return {
    learningPathId: progress.learningPathId,
    learningPathTitle: progress.learningPath.title,
    modules,
    currentModule,
  };
};

export const syncRoadmapProgressForUser = async (userId: string) => {
  const focus = await getUserCurrentFocusFromDB(userId);
  if (!focus) return;

  const progress = await prisma.userLearningProgress.findFirst({
    where: { userId, isActive: true },
  });
  if (!progress) return;

  const modulesCompleted = focus.modules.filter((module) => module.isCompleted).length;
  const progressPercentage =
    focus.modules.length > 0
      ? Math.round((modulesCompleted / focus.modules.length) * 100)
      : 0;

  await prisma.userLearningProgress.update({
    where: { id: progress.id },
    data: {
      currentModuleId: focus.currentModule?.id ?? null,
      progressPercentage,
      ...(modulesCompleted === focus.modules.length &&
      focus.modules.length > 0
        ? { completedAt: new Date() }
        : {}),
    },
  });
};

export const syncRoadmapAchievementsForUser = async (userId: string) => {
  const achievements = await prisma.achievement.findMany({
    where: {
      name: { in: ["Roadmap Starter", "First Module Completed"] },
    },
  });
  if (achievements.length === 0) return;

  const existing = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });
  const hasAchievement = (name: string) =>
    existing.some((record) => record.achievement.name === name);

  const progress = await prisma.userLearningProgress.findFirst({
    where: { userId, isActive: true },
  });

  if (progress && !hasAchievement("Roadmap Starter")) {
    const achievement = achievements.find((a) => a.name === "Roadmap Starter");
    if (achievement) {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });
    }
  }

  const focus = await getUserCurrentFocusFromDB(userId);
  if (
    focus?.modules.some((module) => module.isCompleted) &&
    !hasAchievement("First Module Completed")
  ) {
    const achievement = achievements.find(
      (a) => a.name === "First Module Completed",
    );
    if (achievement) {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });
    }
  }
};

export const getUserAchievementsFromDB = async (userId: string) => {
  const records = await prisma.userAchievement.findMany({
    where: { userId },
    include: {
      achievement: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return records.map((record: any) => ({
    id: record.id,
    achievementId: record.achievementId,
    name: record.achievement.name,
    description: record.achievement.description,
    achievementType: record.achievement.achievementType,
    iconUrl: record.achievement.iconUrl,
    progressData: record.progressData,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
};

export const seedEasyAchievementsInDB = async () => {
  const existing = await prisma.achievement.findMany();

  if (existing.length > 0) {
    return existing;
  }

  await prisma.achievement.createMany({
    data: [
      {
        name: "First Problem Solved",
        description: "Solve your first coding problem.",
        achievementType: "Milestone",
        iconUrl: "first_problem_solved",
      },
      {
        name: "Ten Problems Solved",
        description: "Solve ten coding problems.",
        achievementType: "Milestone",
        iconUrl: "ten_problems_solved",
      },
      {
        name: "First Module Completed",
        description: "Complete all problems in one roadmap module.",
        achievementType: "Module",
        iconUrl: "first_module_completed",
      },
      {
        name: "Roadmap Starter",
        description: "Activate your first roadmap.",
        achievementType: "Roadmap",
        iconUrl: "roadmap_starter",
      },
    ],
    skipDuplicates: true,
  });

  return prisma.achievement.findMany();
};

export const getRoadmapsFromDB = async (): Promise<Roadmap[]> => {
  const roadmaps = await prisma.learningPath.findMany({
    where: {
      ownerUserId: null,
    },
    include: {
      skillLevel: {
        select: { title: true },
      },
      pathModules: {
        select: {
          estimatedHours: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return roadmaps.map((roadmap) => ({
    id: roadmap.id,
    title: roadmap.title,
    createdAt: roadmap.createdAt,
    skillLevel: roadmap.skillLevel.title,
    modulesCount: roadmap.pathModules.length,
    duration: roadmap.pathModules.reduce(
      (sum, module) => sum + (module.estimatedHours || 0),
      0,
    ),
  }));
};

// Get single roadmap with all modules, resources, and problems
export const getRoadmapByIdFromDB = async (
  id: number,
): Promise<RoadmapWithModules | null> => {
  const roadmap = await prisma.learningPath.findUnique({
    where: { id },
    include: {
      skillLevel: {
        select: { title: true },
      },
      pathModules: {
        include: {
          moduleResources: true,
          moduleProblems: true,
          topic: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { moduleOrder: "asc" },
      },
    },
  });

  if (!roadmap) return null;

  return {
    id: roadmap.id,
    title: roadmap.title,
    description: roadmap.description,
    createdAt: roadmap.createdAt,
    skillLevel: roadmap.skillLevel.title,
    targetSkillLevelId: roadmap.targetSkillLevelId,
    pathModules: roadmap.pathModules,
  };
};

// Create new roadmap
export const createRoadmapInDB = async (data: {
  title: string;
  description: string;
  targetSkillLevelId: number;
}): Promise<Roadmap> => {
  const roadmap = await prisma.learningPath.create({
    data,
    include: {
      skillLevel: {
        select: { title: true },
      },
      pathModules: {
        select: {
          estimatedHours: true,
        },
      },
    },
  });

  return {
    id: roadmap.id,
    title: roadmap.title,
    createdAt: roadmap.createdAt,
    skillLevel: roadmap.skillLevel.title,
    modulesCount: roadmap.pathModules.length,
    duration: roadmap.pathModules.reduce(
      (sum, module) => sum + (module.estimatedHours || 0),
      0,
    ),
  };
};

// Update roadmap
export const updateRoadmapInDB = async (
  id: number,
  data: {
    title?: string;
    description?: string;
    targetSkillLevelId?: number;
  },
): Promise<Roadmap> => {
  const roadmap = await prisma.learningPath.update({
    where: { id },
    data,
    include: {
      skillLevel: {
        select: { title: true },
      },
      pathModules: {
        select: {
          estimatedHours: true,
        },
      },
    },
  });

  return {
    id: roadmap.id,
    title: roadmap.title,
    createdAt: roadmap.createdAt,
    skillLevel: roadmap.skillLevel.title,
    modulesCount: roadmap.pathModules.length,
    duration: roadmap.pathModules.reduce(
      (sum, module) => sum + (module.estimatedHours || 0),
      0,
    ),
  };
};

// Delete roadmap
export const deleteRoadmapFromDB = async (id: number): Promise<void> => {
  await prisma.userLearningProgress.deleteMany({
    where: { learningPathId: id },
  });

  // First delete all related resources and problems
  await prisma.moduleResource.deleteMany({
    where: {
      pathModule: {
        learningPathId: id,
      },
    },
  });

  await prisma.moduleProblem.deleteMany({
    where: {
      pathModule: {
        learningPathId: id,
      },
    },
  });

  // Then delete all related modules
  await prisma.pathModule.deleteMany({
    where: {
      learningPathId: id,
    },
  });

  // Finally delete the roadmap itself
  await prisma.learningPath.delete({
    where: { id },
  });
};

// Module CRUD operations
export const createModuleInDB = async (data: {
  learningPathId: number;
  title: string;
  description: string;
  topicId?: number;
  moduleOrder?: number;
  estimatedHours?: number;
  learningObjectives?: any;
  successCriteria?: any;
}): Promise<PathModule> => {
  return prisma.pathModule.create({
    data,
    include: {
      moduleResources: true,
      moduleProblems: true,
      topic: true,
    },
  });
};

export const updateModuleInDB = async (
  id: number,
  data: {
    title?: string;
    description?: string;
    topicId?: number;
    moduleOrder?: number;
    estimatedHours?: number;
    learningObjectives?: any;
    successCriteria?: any;
  },
): Promise<PathModule> => {
  return prisma.pathModule.update({
    where: { id },
    data,
    include: {
      moduleResources: true,
      moduleProblems: true,
    },
  });
};

export const deleteModuleFromDB = async (id: number): Promise<void> => {
  await prisma.pathModule.delete({
    where: { id },
  });
};

// Topic CRUD operations
export const createTopicInDB = async (data: {
  title: string;
  tags: string;
  rating: string;
}): Promise<Topic> => {
  return prisma.topic.create({
    data,
  });
};

export const getTopicsFromDB = async (): Promise<Topic[]> => {
  return prisma.topic.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const getTopicFromDB = async (id: number): Promise<Topic | null> => {
  return prisma.topic.findUnique({
    where: { id },
    include: {
      pathModules: {
        include: {
          moduleResources: true,
          moduleProblems: true,
        },
      },
    },
  });
};

export const updateTopicInDB = async (
  id: number,
  data: {
    title?: string;
    tags?: string;
    rating?: string;
  },
): Promise<Topic> => {
  return prisma.topic.update({
    where: { id },
    data,
  });
};

export const deleteTopicFromDB = async (id: number): Promise<void> => {
  await prisma.topic.delete({
    where: { id },
  });
};

// Resource CRUD operations
export const createResourceInDB = async (data: {
  pathModuleId: number;
  resourceType: string;
  title: string;
  description?: string;
  url?: string;
}): Promise<ModuleResource> => {
  return prisma.moduleResource.create({
    data,
  });
};

export const updateResourceInDB = async (
  id: number,
  data: {
    resourceType?: string;
    title?: string;
    description?: string;
    url?: string;
  },
): Promise<ModuleResource> => {
  return prisma.moduleResource.update({
    where: { id },
    data,
  });
};

export const deleteResourceFromDB = async (id: number): Promise<void> => {
  await prisma.moduleResource.delete({
    where: { id },
  });
};

// Problem CRUD operations
export const createProblemInDB = async (data: {
  pathModuleId: number;
  externalProblemId: string;
  platform: string;
}): Promise<ModuleProblem> => {
  return prisma.moduleProblem.create({
    data,
  });
};

export const updateProblemInDB = async (
  id: number,
  data: {
    externalProblemId?: string;
    platform?: string;
  },
): Promise<ModuleProblem> => {
  return prisma.moduleProblem.update({
    where: { id },
    data,
  });
};

export const deleteProblemFromDB = async (id: number): Promise<void> => {
  await prisma.moduleProblem.delete({
    where: { id },
  });
};
