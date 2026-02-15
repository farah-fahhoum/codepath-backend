import { Request, Response } from "express";
import axios from "axios";
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
} from "../repositories/roadmap.repo";
import { getExternalAccountIntegrationFromDB } from "../repositories/externalAccount.repo";

export const getRoadmaps = async (req: Request, res: Response) => {
  try {
    const roadmaps = await getRoadmapsFromDB();
    return res.status(200).json(roadmaps);
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

    return res.status(200).json(roadmap);
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

    res.status(201).json({
      message: "Roadmap created successfully",
      roadmap: roadmap,
    });
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

    res.status(200).json({
      message: "Roadmap updated successfully",
      roadmap: roadmap,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteRoadmap = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await deleteRoadmapFromDB(id);

    return res.status(200).json({
      message: "Roadmap deleted successfully",
    });
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

    res.status(201).json({
      message: "Module created successfully",
      module: module,
    });
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

    res.status(200).json({
      message: "Module updated successfully",
      module: module,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteModule = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await deleteModuleFromDB(id);

    return res.status(200).json({
      message: "Module deleted successfully",
    });
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

    res.status(201).json({
      message: "Resource created successfully",
      resource: resource,
    });
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

    res.status(200).json({
      message: "Resource updated successfully",
      resource: resource,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteResource = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await deleteResourceFromDB(id);

    return res.status(200).json({
      message: "Resource deleted successfully",
    });
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

    res.status(201).json({
      message: "Problem created successfully",
      problem: problem,
    });
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

    res.status(200).json({
      message: "Problem updated successfully",
      problem: problem,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error: ", error });
  }
};

export const deleteProblem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await deleteProblemFromDB(Number(id));

    return res.status(200).json({
      message: "Problem deleted successfully",
    });
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
    if (!externalAccount || !externalAccount.handle) {
      return res.status(404).json({
        message:
          "User handle not found. Please connect your coding platform account.",
      });
    }

    const userHandle = externalAccount.handle;

    // Call both FastAPI endpoints in parallel
    const [performanceResponse, aiSummaryResponse] = await Promise.all([
      // Topic performance endpoint
      axios.get(
        `${process.env.FASTAPI_BASE_URL}/topic/${topic}?user_handle=${userHandle}`,
        {
          headers: { accept: "application/json" },
          timeout: 10000,
        },
      ),
      // AI summary endpoint
      axios.get(
        `${process.env.FASTAPI_BASE_URL}/topic/${topic}/ai-summary?user_handle=${userHandle}`,
        {
          headers: { accept: "application/json" },
          timeout: 15000,
        },
      ),
    ]);

    // Combine both responses
    const combinedResponse = {
      ...performanceResponse.data,
      ai_insights: aiSummaryResponse.data.ai_insights,
      performance_breakdown: aiSummaryResponse.data.performance,
    };

    return res.status(200).json(combinedResponse);
  } catch (error) {
    console.error("Error fetching topic performance data from FastAPI:", error);

    // Try to get at least the basic performance data if AI summary fails
    // try {
    //   // @ts-expect-error userId is defined
    //   const userId = req.user?.id as string;
    //   const { topic } = req.query;
    //   const externalAccount = await getExternalAccountIntegrationFromDB(userId);

    //   if (externalAccount && externalAccount.handle) {
    //     const performanceResponse = await axios.get(
    //       `${process.env.FASTAPI_BASE_URL}/topic/${topic}?user_handle=${externalAccount.handle}`,
    //       {
    //         headers: { accept: "application/json" },
    //         timeout: 10000,
    //       },
    //     );

    //     return res.status(200).json({
    //       ...performanceResponse.data,
    //       ai_insights:
    //         "AI insights are temporarily unavailable. Please try again later.",
    //       performance_breakdown: {},
    //     });
    //   }
    // } catch (fallbackError) {
    //   return res.status(500).json({
    //     message: "Failed to fetch topic performance data",
    //     error: error.message,
    //   });
    // }

    return res.status(500).json({
      message: "Failed to fetch topic performance data",
      error: error.message,
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

    return res.status(200).json({
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
    });
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

    return res.status(200).json(summary);
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

    return res.status(200).json(currentFocus.currentModule);
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

    const focusData = await getUserCurrentFocusFromDB(userId);

    if (!focusData) {
      return res.status(404).json({
        message: "No active roadmap found for mentee",
      });
    }

    return res.status(200).json(focusData);
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

    return res.status(200).json(achievements);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
