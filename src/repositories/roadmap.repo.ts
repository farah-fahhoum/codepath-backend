import { prisma } from "../lib/prisma";
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

export const getUserRoadmapSummaryFromDB = async (userId: string) => {
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
            },
          },
        },
      },
    },
  });

  if (!progress) {
    return null;
  }

  const totalModules = progress.learningPath.pathModules.length;
  const modulesCompleted = Math.round(
    (progress.progressPercentage / 100) * totalModules,
  );

  return {
    learningPathId: progress.learningPathId,
    learningPathTitle: progress.learningPath.title,
    progressPercentage: progress.progressPercentage,
    modulesCompleted,
    totalModules,
  };
};

export const activateUserRoadmapForSkillLevelInDB = async (
  userId: string,
  skillLevelId: number,
) => {
  const learningPath = await prisma.learningPath.findFirst({
    where: {
      targetSkillLevelId: skillLevelId,
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
    where: {
      userId,
      solved: true,
    },
  });

  const solvedSet = new Set(
    attempts.map((a) => `${a.platform}:${a.externalProblemId}`),
  );

  const modules = progress.learningPath.pathModules.map((module) => {
    const totalProblems = module.moduleProblems.length;
    const solvedProblems = module.moduleProblems.filter((problem) =>
      solvedSet.has(`${problem.platform}:${problem.externalProblemId}`),
    ).length;

    const completionPercentage =
      totalProblems === 0
        ? 0
        : Math.round((solvedProblems / totalProblems) * 100);

    const isCompleted = totalProblems > 0 && solvedProblems === totalProblems;

    return {
      id: module.id,
      title: module.title,
      moduleOrder: module.moduleOrder,
      totalProblems,
      solvedProblems,
      completionPercentage,
      isCompleted,
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
        orderBy: { createdAt: "asc" },
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
