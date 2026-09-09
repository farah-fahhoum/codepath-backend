import { Request, Response } from "express";
import {
  getMenteeAccuracy,
  getMenteeAIInsights,
  getMenteeCodePathLevel,
  getMenteeCodePathRating,
  getMenteeCodePrint,
  getMenteeProblemsSolvedCount,
  getMenteesTotalInEachLevel,
  getTop3PopularTopics,
  getTotalMentees,
  getTotalProblemsSolved,
  getTotalSubmissions,
  getActivityByDateForUser,
  getMonthlyGrowthForUser,
} from "../repositories/statistics.repo";
import { getMenteeSkillProfile } from "../services/assessment.service";

export const getAdminStatistics = async (req: Request, res: Response) => {
  try {
    const totalMentees = await getTotalMentees();
    const problemsSolved = await getTotalProblemsSolved();
    const totalSubmissions = await getTotalSubmissions();
    const menteesDistributedByLevels = await getMenteesTotalInEachLevel();
    const popularTopics = await getTop3PopularTopics();

    return res.status(200).json({
      totalMentees: totalMentees,
      problemsSolved: problemsSolved,
      totalSubmissions: totalSubmissions,
      menteesDistributedByLevels: menteesDistributedByLevels,
      popularTopics: popularTopics,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMenteeStatistics = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const codePathRating = await getMenteeCodePathRating(userId);
    const codePathLevel = await getMenteeCodePathLevel(userId);
    const problemsSolved = await getMenteeProblemsSolvedCount(userId);
    const accuracy = await getMenteeAccuracy(userId);
    const yourCodePrint = await getMenteeCodePrint(userId);
    const insightsPanel = await getMenteeAIInsights(userId);
    const skillProfile = await getMenteeSkillProfile(userId);

    return res.status(200).json({
      codePathRating: codePathRating,
      codePathLevel: codePathLevel.tier,
      problemsSolved: problemsSolved,
      accuracy: accuracy,
      yourCodePrint: yourCodePrint,
      insightsPanel: insightsPanel,
      skillProfile,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMenteeActivity = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string | undefined;
    if (!userId)
      return res.status(401).json({ message: "Unauthorized" });
    const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
    if (Number.isNaN(year) || year < 2000 || year > 2100)
      return res.status(400).json({ message: "Invalid year" });
    const activity = await getActivityByDateForUser(userId, year);
    return res.status(200).json(activity);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMenteeGrowth = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string | undefined;
    if (!userId)
      return res.status(401).json({ message: "Unauthorized" });
    const months = await getMonthlyGrowthForUser(userId);
    return res.status(200).json({ months });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
