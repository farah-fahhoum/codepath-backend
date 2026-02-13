import { Request, Response } from "express";
import Joi from "joi";
import axios from "axios";
import fs from "fs";
import { prisma } from "../lib/prisma";
import {
  addProblemToFavouriteDB,
  checkFavouriteBelongsToUser,
  checkFavouriteExistForUser,
  createExternalSubmission,
  deleteProblemFromFavouriteDB,
  getExternalAccountByUserIdAndPlatform,
  getProblemFromCodeforces,
  getUserFavouriteProblemsFromDB,
  upsertUserProblemAttempt,
} from "../repositories/problem.repo";
export const getProblems = async (req: Request, res: Response) => {
  try {
    const querySchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(200).default(20),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const resp = await axios.get(
      "https://codeforces.com/api/problemset.problems",
      { timeout: 10000 },
    );
    const cfProblems = resp.data;
    if (!cfProblems || cfProblems.status !== "OK") {
      return res.status(502).json({
        message: "Upstream API returned non-OK status",
        status: cfProblems.status,
      });
    }
    //Needs to add if in user's favourite field
    const allProblems = (cfProblems?.result?.problems ?? []).map((p: any) => ({
      title: p.name,
      tags: p.tags ?? [],
      rating: p.rating ?? null,
      index: p.index,
      contestId: p.contestId ?? null,
    }));

    const total = allProblems.length;
    const start = (value.page - 1) * value.limit;
    const items = allProblems.slice(start, start + value.limit);

    return res.status(200).json({
      page: value.page,
      limit: value.limit,
      total,
      totalPages: Math.ceil(total / value.limit),
      items,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return res.status(502).json({
        message: "Upstream API error",
        status: error.response?.status ?? 0,
        details: error.message,
      });
    }
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getProblem = async (req: Request, res: Response) => {
  try {
    const paramsSchema = Joi.object({
      contestId: Joi.number().integer().min(1).required(),
      index: Joi.string().required(),
    });
    const { value, error } = paramsSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const envExec = process.env.PUPPETEER_EXECUTABLE_PATH;
    const macChrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const execPath =
      envExec ?? (fs.existsSync(macChrome) ? macChrome : undefined);

    const data = await getProblemFromCodeforces(value.contestId, value.index, {
      executablePath: execPath,
    });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const submitProblem = async (req: Request, res: Response) => {
  try {
    const submissionSchema = Joi.object({
      externalSubmissionId: Joi.string().required(),
      problemId: Joi.string().required(),
      platform: Joi.string().required(),
      submissionTime: Joi.number().required(),
      verdict: Joi.string().required(),
      executionTime: Joi.number().optional(),
      memoryUsed: Joi.number().optional(),
      programmingLanguage: Joi.string().required(),
    });

    const { value, error } = submissionSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    // Get external account for the user
    const externalAccount = await getExternalAccountByUserIdAndPlatform(
      userId,
      value.platform,
    );
    if (!externalAccount) {
      return res.status(404).json({
        message: `No external account found for platform: ${value.platform}`,
      });
    }

    // Determine if problem was solved
    const solved = ["AC", "Accepted", "OK"].includes(value.verdict);

    // Get current attempt info
    const currentAttempt = await prisma.userProblemAttempt.findUnique({
      where: {
        userId_externalProblemId_platform: {
          userId,
          externalProblemId: value.problemId,
          platform: value.platform,
        },
      },
    });

    const attemptCount = (currentAttempt?.attemptCount || 0) + 1;
    const bestExecutionTime = solved
      ? Math.min(
          currentAttempt?.bestExecutionTime || Infinity,
          value.executionTime || Infinity,
        )
      : currentAttempt?.bestExecutionTime || null;

    // Create external submission
    await createExternalSubmission(
      value.externalSubmissionId,
      externalAccount.id.toString(),
      value.problemId,
      value.submissionTime,
      value.verdict,
      value.executionTime || 0,
      value.memoryUsed || 0,
      value.programmingLanguage,
    );

    // Update user problem attempt
    await upsertUserProblemAttempt(
      userId,
      value.problemId,
      value.platform,
      solved,
      attemptCount,
      bestExecutionTime,
    );

    if (solved) {
      const solvedCount = await prisma.userProblemAttempt.count({
        where: {
          userId,
          solved: true,
        },
      });

      const achievements = await prisma.achievement.findMany({
        where: {
          name: {
            in: ["First Problem Solved", "Ten Problems Solved"],
          },
        },
      });

      const existingUserAchievements = await prisma.userAchievement.findMany({
        where: {
          userId,
          achievement: {
            name: {
              in: ["First Problem Solved", "Ten Problems Solved"],
            },
          },
        },
        include: {
          achievement: true,
        },
      });

      const hasAchievement = (name: string) =>
        existingUserAchievements.some(
          (ua: { achievement: { name: string } }) =>
            ua.achievement.name === name,
        );

      const firstProblemAchievement = achievements.find(
        (a: { name: string }) => a.name === "First Problem Solved",
      );

      if (firstProblemAchievement && solvedCount >= 1) {
        if (!hasAchievement("First Problem Solved")) {
          await prisma.userAchievement.create({
            data: {
              userId,
              achievementId: firstProblemAchievement.id,
              progressData: {
                totalSolved: solvedCount,
              },
            },
          });
        }
      }

      const tenProblemsAchievement = achievements.find(
        (a: { name: string }) => a.name === "Ten Problems Solved",
      );

      if (tenProblemsAchievement && solvedCount >= 10) {
        if (!hasAchievement("Ten Problems Solved")) {
          await prisma.userAchievement.create({
            data: {
              userId,
              achievementId: tenProblemsAchievement.id,
              progressData: {
                totalSolved: solvedCount,
              },
            },
          });
        }
      }
    }

    return res.status(201).json({
      message: "Problem submission recorded successfully",
      solved,
      attemptCount,
    });
  } catch (error) {
    console.error("Error in submitProblem:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

//Get user's favourite problems list
export const getFavouriteProblems = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const favouriteList = await getUserFavouriteProblemsFromDB(userId);
    return res.status(200).json(favouriteList);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const addProblemToFavourite = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      externalProblemId: Joi.string().required(),
      platform: Joi.string().valid("Codeforces", "LeetCode").required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { externalProblemId, platform } = value;

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const recordCheck = await checkFavouriteExistForUser(
      userId,
      externalProblemId,
      platform,
    );
    if (recordCheck) {
      return res
        .status(409)
        .json({ message: "Problem already saved in favourites for this user" });
    }

    await addProblemToFavouriteDB(userId, externalProblemId, platform);
    return res
      .status(201)
      .json({ message: "Problem added to favourite successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const removeProblemFromFavourite = async (
  req: Request,
  res: Response,
) => {
  try {
    const paramsSchema = Joi.object({
      id: Joi.string().required(),
    });
    const { value, error } = paramsSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const userCheck = await checkFavouriteBelongsToUser(userId, value.id);
    if (!userCheck) {
      return res.status(403).json({
        message: "User unauthorized to delete this problem from favourite",
      });
    }

    await deleteProblemFromFavouriteDB(value.id);
    return res
      .status(201)
      .json({ message: "Problem deleted from favourite successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
