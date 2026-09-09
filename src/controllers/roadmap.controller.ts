import { Request, Response } from "express";
import axios from "axios";
import { ok } from "../lib/response";
import {
  getRoadmapsFromDB,
  getRoadmapByIdFromDB,
  createRoadmapInDB,
  updateRoadmapInDB,
  deleteRoadmapFromDB,
  createModuleInDB,
  updateModuleInDB,
  deleteModuleFromDB,
  createResourceInDB,
  updateResourceInDB,
  deleteResourceFromDB,
  createProblemInDB,
  updateProblemInDB,
  deleteProblemFromDB,
  getActiveUserLearningProgressFromDB,
  getUserRoadmapSummaryFromDB,
  getUserCurrentFocusFromDB,
  getUserAchievementsFromDB,
  syncRoadmapAchievementsForUser,
  syncRoadmapProgressForUser,
  activateRoadmapForUserSkillProfile,
} from "../repositories/roadmap.repo";
import { getExternalAccountIntegrationFromDB } from "../repositories/externalAccount.repo";
import {
  createPersonalRoadmapInDB,
  attachProblemsToPersonalModulesInDB,
  getUserTopicsFromDB,
  getUserSkillAssessmentsFromDB,
  getUserQuizPerformanceFromDB,
  getUserCodeforcesStatsFromDB,
  getLatestSkillLevelIdFromDB,
} from "../repositories/roadmapAI.repo";
import { FastAPIError, generateRoadmap } from "../lib/fastapiClient";
import { resolveFastApiTopicName } from "../lib/fastapiTopics";
import { getMenteeSkillProfile } from "../services/assessment.service";
import type { MenteeSkillProfile } from "../types/assessment.type";

function buildTopicOverviewFromSkillProfile(
  skillProfile: MenteeSkillProfile,
  topic: string,
  aiInsights?: string,
) {
  const topicPerformance =
    skillProfile.sources.codepath.topicPerformance.find(
      (entry) => entry.topic.toLowerCase() === topic.toLowerCase(),
    );

  return {
    proficiency_level: skillProfile.tier,
    accuracy_rate:
      topicPerformance?.accuracy ??
      skillProfile.sources.codepath.accuracy ??
      0,
    performance_breakdown: {
      roadmap_problems: 0,
      general_problems: topicPerformance?.solved ?? 0,
      wrong_submissions: topicPerformance
        ? Math.max(0, topicPerformance.attempts - topicPerformance.solved)
        : 0,
      accepted_solutions: topicPerformance?.solved ?? 0,
    },
    ai_insights:
      aiInsights ??
      "Codeforces topic analytics are unavailable for this module title. Showing CodePath stats instead.",
  };
}

export const getRoadmaps = async (req: Request, res: Response) => {
  try {
    const roadmaps = await getRoadmapsFromDB();
    return res.status(200).json(ok(roadmaps));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getRoadmap = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const roadmap = await getRoadmapByIdFromDB(id);

    if (!roadmap) {
      return res.status(404).json({
        message: "Roadmap not found",
      });
    }

    return res.status(200).json(ok(roadmap));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const createRoadmap = async (req: Request, res: Response) => {
  try {
    const { title, description, targetSkillLevelId } = req.body;

    if (!title || !description || !targetSkillLevelId) {
      return res.status(400).json({
        message: "Title, description, and targetSkillLevelId are required",
      });
    }

    const roadmap = await createRoadmapInDB({
      title,
      description,
      targetSkillLevelId: parseInt(targetSkillLevelId),
    });

    res.status(201).json(ok({ roadmap }, "Roadmap created successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const updateRoadmap = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, targetSkillLevelId } = req.body;

    const roadmap = await updateRoadmapInDB(id, {
      title,
      description,
      targetSkillLevelId: parseInt(targetSkillLevelId),
    });

    res.status(200).json(ok({ roadmap }, "Roadmap updated successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteRoadmap = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await deleteRoadmapFromDB(id);

    return res.status(200).json(ok(null, "Roadmap deleted successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

// Module CRUD operations

export const createModule = async (req: Request, res: Response) => {
  try {
    const {
      learningPathId,
      title,
      description,
      topicId,
      moduleOrder,
      estimatedHours,
      learningObjectives,
      successCriteria,
    } = req.body;

    if (!learningPathId || !title || !description) {
      return res.status(400).json({
        message: "learningPathId, title, and description are required",
      });
    }

    const module = await createModuleInDB({
      learningPathId: parseInt(learningPathId),
      title,
      description,
      topicId: topicId ? parseInt(topicId) : undefined,
      moduleOrder: moduleOrder ? parseInt(moduleOrder) : undefined,
      estimatedHours: estimatedHours ? parseInt(estimatedHours) : undefined,
      learningObjectives,
      successCriteria,
    });

    res.status(201).json(ok({ module }, "Module created successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const updateModule = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const {
      title,
      description,
      topicId,
      moduleOrder,
      estimatedHours,
      learningObjectives,
      successCriteria,
    } = req.body;

    const module = await updateModuleInDB(id, {
      title,
      description,
      topicId: topicId ? parseInt(topicId) : undefined,
      moduleOrder: moduleOrder ? parseInt(moduleOrder) : undefined,
      estimatedHours: estimatedHours ? parseInt(estimatedHours) : undefined,
      learningObjectives,
      successCriteria,
    });

    res.status(200).json(ok({ module }, "Module updated successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteModule = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await deleteModuleFromDB(id);

    return res.status(200).json(ok(null, "Module deleted successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

// Resource CRUD operations

export const createResource = async (req: Request, res: Response) => {
  try {
    const { pathModuleId, resourceType, title, description, url } = req.body;

    if (!pathModuleId || !resourceType || !title) {
      return res.status(400).json({
        message: "pathModuleId, resourceType, and title are required",
      });
    }

    const resource = await createResourceInDB({
      pathModuleId: Number(pathModuleId),
      resourceType,
      title,
      description,
      url,
    });

    res.status(201).json(ok({ resource }, "Resource created successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const updateResource = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { resourceType, title, description, url } = req.body;

    const resource = await updateResourceInDB(id, {
      resourceType,
      title,
      description,
      url,
    });

    res.status(200).json(ok({ resource }, "Resource updated successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteResource = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await deleteResourceFromDB(id);

    return res.status(200).json(ok(null, "Resource deleted successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

// Problem CRUD operations

export const createProblem = async (req: Request, res: Response) => {
  try {
    const { pathModuleId, externalProblemId, platform } = req.body;

    if (!pathModuleId || !externalProblemId || !platform) {
      return res.status(400).json({
        message: "pathModuleId, externalProblemId, and platform are required",
      });
    }

    const problem = await createProblemInDB({
      pathModuleId,
      externalProblemId,
      platform,
    });

    res.status(201).json(ok({ problem }, "Problem created successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const updateProblem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { externalProblemId, platform } = req.body;

    const problem = await updateProblemInDB(Number(id), {
      externalProblemId,
      platform,
    });

    res.status(200).json(ok({ problem }, "Problem updated successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteProblem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await deleteProblemFromDB(Number(id));

    return res.status(200).json(ok(null, "Problem deleted successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const getMenteeTopicPerformanceOverview = async (
  req: Request,
  res: Response,
) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { topic } = req.query;
    if (!topic || typeof topic !== "string") {
      return res
        .status(400)
        .json({ message: "Topic query parameter is required" });
    }

    const externalAccount = await getExternalAccountIntegrationFromDB(userId);
    const skillProfile = await getMenteeSkillProfile(userId);

    if (!externalAccount?.handle) {
      return res.status(200).json(
        ok(
          buildTopicOverviewFromSkillProfile(
            skillProfile,
            topic,
            "Connect Codeforces for deeper AI-powered topic insights.",
          ),
        ),
      );
    }

    const userHandle = externalAccount.handle;
    const fastApiTopic = resolveFastApiTopicName(topic);

    if (!fastApiTopic) {
      return res.status(200).json(
        ok(buildTopicOverviewFromSkillProfile(skillProfile, topic)),
      );
    }

    const encodedTopic = encodeURIComponent(fastApiTopic);
    const baseUrl = process.env.FASTAPI_BASE_URL;

    let performanceResponse;
    try {
      performanceResponse = await axios.get(
        `${baseUrl}/topic/${encodedTopic}?user_handle=${encodeURIComponent(userHandle)}`,
        {
          headers: { accept: "application/json" },
          timeout: 10000,
        },
      );
    } catch (performanceError) {
      if (
        axios.isAxiosError(performanceError) &&
        performanceError.response?.status === 404
      ) {
        return res.status(200).json(
          ok(buildTopicOverviewFromSkillProfile(skillProfile, topic)),
        );
      }
      throw performanceError;
    }

    let aiData: Record<string, unknown> | null = null;
    try {
      const aiSummaryResponse = await axios.get(
        `${baseUrl}/topic/${encodedTopic}/ai-summary?user_handle=${encodeURIComponent(userHandle)}`,
        {
          headers: { accept: "application/json" },
          timeout: 15000,
        },
      );
      aiData =
        aiSummaryResponse.data?.data ?? aiSummaryResponse.data ?? null;
    } catch (aiError) {
      if (
        !axios.isAxiosError(aiError) ||
        (aiError.response?.status !== 404 && aiError.response?.status !== 422)
      ) {
        console.warn(
          "AI topic summary unavailable for topic:",
          fastApiTopic,
          aiError,
        );
      }
    }

    const topicData =
      performanceResponse.data?.data ?? performanceResponse.data;
    const combinedResponse = {
      ...topicData,
      ai_insights:
        (aiData?.ai_insights as string | undefined) ??
        "AI insights are temporarily unavailable for this topic.",
      performance_breakdown:
        (aiData?.performance as Record<string, unknown> | undefined) ??
        topicData?.performance_breakdown,
    };

    return res.status(200).json(ok(combinedResponse));
  } catch (error) {
    console.error("Error fetching topic performance data from FastAPI:", error);

    return res.status(500).json({
      message: "Failed to fetch topic performance data",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const getMenteeRoadmap = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const progress = await getActiveUserLearningProgressFromDB(userId);

    if (!progress) {
      return res.status(404).json({
        message: "No active roadmap found for mentee",
      });
    }

    return res.status(200).json(ok({
      learningPathId: progress.learningPathId,
      learningPathTitle: progress.learningPath.title,
      skillLevel: progress.learningPath.skillLevel.title,
      currentModuleId: progress.currentModuleId,
      currentModuleTitle: progress.currentModule
        ? progress.currentModule.title
        : null,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      progressPercentage: progress.progressPercentage,
      isActive: progress.isActive,
      modules: progress.learningPath.pathModules,
    }));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMyRoadmapSummary = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const summary = await getUserRoadmapSummaryFromDB(userId);

    if (!summary) {
      return res.status(404).json({
        message: "No active roadmap found for mentee",
      });
    }

    return res.status(200).json(ok(summary));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMyRoadmapCurrentFocus = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const currentFocus = await getUserCurrentFocusFromDB(userId);

    if (!currentFocus) {
      return res.status(404).json({
        message: "No active roadmap found for mentee",
      });
    }

    return res.status(200).json(ok(currentFocus.currentModule));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMyRoadmapModulesWithProgress = async (
  req: Request,
  res: Response,
) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await activateRoadmapForUserSkillProfile(userId);
    await syncRoadmapProgressForUser(userId);
    const focusData = await getUserCurrentFocusFromDB(userId);

    if (!focusData) {
      return res.status(404).json({
        message: "No active roadmap found for mentee",
      });
    }

    return res.status(200).json(ok(focusData));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMyRoadmapAchievements = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const achievements = await getUserAchievementsFromDB(userId);

    return res.status(200).json(ok(achievements));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const generateMyRoadmap = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const topics = await getUserTopicsFromDB();
    if (topics.length === 0) {
      return res.status(400).json({
        message: "No topics available to build a roadmap",
      });
    }

    const [assessments, quizPerformance, codeforcesStats, skillProfile] =
      await Promise.all([
        getUserSkillAssessmentsFromDB(userId),
        getUserQuizPerformanceFromDB(userId),
        getUserCodeforcesStatsFromDB(userId),
        getMenteeSkillProfile(userId, { forceRefresh: true }),
      ]);

    let response;
    try {
      response = await generateRoadmap({
        userId,
        topics: topics.map((topic) => ({ id: topic.id, title: topic.title })),
        skillAssessments: assessments.map((assessment) => ({
          assessmentType: assessment.assessmentType,
          score: assessment.score,
          skillLevelId: assessment.skillLevelId,
        })),
        quizPerformance,
        codeforcesStats,
        codepathStats: {
          solvedCount: skillProfile.sources.codepath.solvedCount,
          attemptedCount: skillProfile.sources.codepath.attemptedCount,
          avgSolvedRating: skillProfile.sources.codepath.avgSolvedRating,
          accuracy: skillProfile.sources.codepath.accuracy,
          topicPerformance: skillProfile.sources.codepath.topicPerformance,
        },
        contestStats: {
          participatedCount: skillProfile.sources.contest.participatedCount,
          finishedCount: skillProfile.sources.contest.finishedCount,
          avgSolveRate: skillProfile.sources.contest.avgSolveRate,
          avgProblemRating: skillProfile.sources.contest.avgProblemRating,
          totalContestSolves: skillProfile.sources.contest.totalContestSolves,
        },
        placement: skillProfile.sources.placement
          ? {
              skillLevelTitle: skillProfile.sources.placement.skillLevelTitle,
              assessmentType: skillProfile.sources.placement.assessmentType,
              score: skillProfile.sources.placement.score,
              assessedAt: skillProfile.sources.placement.assessedAt,
            }
          : null,
      });
    } catch (serviceError) {
      if (serviceError instanceof FastAPIError) {
        return res.status(serviceError.status).json({
          message: serviceError.message,
        });
      }
      throw serviceError;
    }

    if (!response.modules || response.modules.length === 0) {
      return res.status(400).json({
        message: "No roadmap modules could be generated",
      });
    }

    const targetSkillLevelId =
      skillProfile.skillLevelId ?? (await getLatestSkillLevelIdFromDB(userId));
    if (targetSkillLevelId == null) {
      return res.status(500).json({
        message: "No skill level configured for the platform",
      });
    }

    const modulesWithTopics = response.modules.map((module) => ({
      ...module,
      topicId:
        module.topicId ??
        topics.find(
          (topic) =>
            topic.title.toLowerCase() === module.topicTitle.toLowerCase(),
        )?.id ??
        null,
    }));

    const { learningPath, createdModules, progress } =
      await createPersonalRoadmapInDB(
        userId,
        targetSkillLevelId,
        modulesWithTopics,
      );

    await attachProblemsToPersonalModulesInDB(createdModules);
    await syncRoadmapProgressForUser(userId);
    await syncRoadmapAchievementsForUser(userId);

    return res.status(201).json(ok({
      roadmap: {
        id: learningPath.id,
        title: learningPath.title,
        description: learningPath.description,
        progressId: progress.id,
        currentModuleId: progress.currentModuleId,
      },
      modules: createdModules.map((module, idx) => ({
        order: module.order,
        topicId: module.topicId,
        topicTitle: module.topicTitle,
        suggestedDifficultyRange: module.suggestedDifficultyRange,
        learningObjective: modulesWithTopics[idx]?.learningObjective ?? "",
        estimatedHours: modulesWithTopics[idx]?.estimatedHours ?? 0,
        practiceProblems: modulesWithTopics[idx]?.practiceProblems ?? [],
      })),
    }, "Personal roadmap generated successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
