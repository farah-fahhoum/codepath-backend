import { Request, Response } from "express";
import {
  getMenteeAccuracy,
  getMenteeCodePathLevel,
  getMenteeCodePathRating,
  getMenteeCodePrint,
  getMenteeProblemsSolvedCount,
  getMenteesTotalInEachLevel,
  getTop3PopularTopics,
  getTotalMentees,
  getTotalProblemsSolved,
  getTotalSubmissions,
} from "../repositories/statistics.repo";

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

    return res.status(200).json({
      codePathRating: codePathRating,
      codePathLevel: codePathLevel,
      problemsSolved: problemsSolved,
      accuracy: accuracy,
      yourCodePrint: yourCodePrint,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
