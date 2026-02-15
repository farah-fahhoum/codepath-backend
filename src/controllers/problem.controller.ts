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
  getCodeforcesProblemsMap,
  getProblemFromCodeforces,
  getUserFavouriteProblemsFromDB,
  upsertUserProblemAttempt,
} from "../repositories/problem.repo";
export const getProblems = async (req: Request, res: Response) => {
  try {
    const querySchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(200).default(20),
      minRating: Joi.number().integer().min(0).optional().allow(null),
      tag: Joi.string().optional().allow("").allow(null),
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
    const allProblems = (cfProblems?.result?.problems ?? []).map((p: any) => ({
      title: p.name,
      tags: p.tags ?? [],
      rating: p.rating ?? null,
      index: p.index,
      contestId: p.contestId ?? null,
    }));

    let filtered = allProblems;
    if (value.minRating != null && value.minRating > 0) {
      filtered = filtered.filter(
        (p: { rating: number | null }) =>
          p.rating != null && p.rating >= value.minRating
      );
    }
    if (value.tag && value.tag !== "all") {
      filtered = filtered.filter((p: { tags: string[] }) =>
        p.tags.includes(value.tag)
      );
    }

    const total = filtered.length;
    const start = (value.page - 1) * value.limit;
    const items = filtered.slice(start, start + value.limit);

    const availableTags = [
      ...new Set(allProblems.flatMap((p: { tags: string[] }) => p.tags)),
    ].sort();

    return res.status(200).json({
      page: value.page,
      limit: value.limit,
      total,
      totalPages: Math.ceil(total / value.limit) || 1,
      items,
      availableTags,
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

const PISTON_EXECUTE_URL = "https://emkc.org/api/v2/piston/execute";

const PISTON_LANGUAGE_MAP: Record<string, string> = {
  cpp: "cpp",
  java: "java",
  python: "python",
  javascript: "javascript",
};

export const runCode = async (req: Request, res: Response) => {
  try {
    const bodySchema = Joi.object({
      code: Joi.string().required(),
      language: Joi.string()
        .valid("cpp", "java", "python", "javascript")
        .required(),
      stdin: Joi.string().allow("").optional(),
    });
    const { value, error } = bodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pistonLanguage = PISTON_LANGUAGE_MAP[value.language] ?? value.language;

    const response = await axios.post(
      PISTON_EXECUTE_URL,
      {
        language: pistonLanguage,
        version: "*",
        files: [{ content: value.code }],
        stdin: value.stdin ?? "",
      },
      { timeout: 15000 },
    );

    const data = response.data;
    const run = data?.run;
    if (!run) {
      return res.status(502).json({
        message: "Unexpected response from code execution service",
      });
    }

    const stdout = run.stdout ?? "";
    const stderr = run.stderr ?? "";
    const combined =
      stderr.trim().length > 0 ? `${stderr}\n${stdout}` : stdout;

    return res.status(200).json({
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
      output: combined,
      code: run.code,
      signal: run.signal ?? null,
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 502;
      const message =
        err.response?.data?.message ??
        err.message ??
        "Code execution service error";
      return res.status(status).json({
        message: status === 502 ? "Code execution service unavailable" : message,
      });
    }
    return res.status(500).json({ message: "Internal Server Error", error: {} });
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

/** Sync latest Codeforces submission for this problem and record it (Mentee, Codeforces linked). */
export const syncSubmissionFromCodeforces = async (
  req: Request,
  res: Response,
) => {
  try {
    const bodySchema = Joi.object({
      contestId: Joi.number().integer().min(1).required(),
      index: Joi.string().required(),
    });
    const { value, error } = bodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const externalAccount = await getExternalAccountByUserIdAndPlatform(
      userId,
      "Codeforces",
    );
    if (!externalAccount || !(externalAccount as { handle?: string }).handle) {
      return res.status(404).json({
        message:
          "Link your Codeforces account first to sync submissions.",
      });
    }

    const handle = (externalAccount as { handle: string }).handle;
    let cfResp;
    try {
      cfResp = await axios.get(
        "https://codeforces.com/api/user.status",
        {
          params: { handle, from: 1, count: 50 },
          timeout: 10000,
        },
      );
    } catch (cfErr: unknown) {
      if (axios.isAxiosError(cfErr)) {
        const status = cfErr.response?.status;
        const isUnavailable = status === 502 || status === 503 || status === 504;
        return res.status(502).json({
          message: isUnavailable
            ? "Codeforces is temporarily unavailable. Please try again in a few minutes."
            : (cfErr.response?.data as { comment?: string })?.comment ?? "Codeforces API error",
        });
      }
      throw cfErr;
    }

    if (!cfResp.data || cfResp.data.status !== "OK") {
      return res.status(502).json({
        message:
          cfResp.data?.comment ?? "Codeforces API returned non-OK status",
      });
    }

    const submissions = cfResp.data.result ?? [];
    const match = submissions.find(
      (s: { contestId: number; problem: { index: string } }) =>
        s.contestId === value.contestId && s.problem?.index === value.index,
    );

    if (!match) {
      return res.status(404).json({
        message:
          "No submission found for this problem. Submit on Codeforces first, then sync.",
      });
    }

    const problemId = `${value.contestId}${value.index}`;
    const submissionTime = match.creationTimeSeconds ?? Math.floor(Date.now() / 1000);
    const verdict = match.verdict ?? "";
    const executionTime = match.timeConsumedMillis ?? 0;
    const memoryUsed = match.memoryConsumedBytes ?? 0;
    const programmingLanguage = match.programmingLanguage ?? "";

    const solved = ["AC", "Accepted", "OK"].includes(verdict);

    const currentAttempt = await prisma.userProblemAttempt.findUnique({
      where: {
        userId_externalProblemId_platform: {
          userId,
          externalProblemId: problemId,
          platform: "Codeforces",
        },
      },
    });

    const attemptCount = (currentAttempt?.attemptCount ?? 0) + 1;
    const bestExecutionTime = solved
      ? Math.min(
          currentAttempt?.bestExecutionTime ?? Infinity,
          executionTime || Infinity,
        )
      : currentAttempt?.bestExecutionTime ?? null;

    try {
      await createExternalSubmission(
        String(match.id),
        externalAccount.id.toString(),
        problemId,
        submissionTime,
        verdict,
        executionTime,
        memoryUsed,
        programmingLanguage,
      );
    } catch (createErr: unknown) {
      const prismaErr = createErr as { code?: string };
      if (prismaErr?.code === "P2002") {
        return res.status(200).json({
          message: "Submission already recorded",
          solved,
          attemptCount: currentAttempt?.attemptCount ?? attemptCount,
        });
      }
      throw createErr;
    }

    await upsertUserProblemAttempt(
      userId,
      problemId,
      "Codeforces",
      solved,
      attemptCount,
      bestExecutionTime,
    );

    if (solved) {
      const solvedCount = await prisma.userProblemAttempt.count({
        where: { userId, solved: true },
      });

      const achievements = await prisma.achievement.findMany({
        where: {
          name: { in: ["First Problem Solved", "Ten Problems Solved"] },
        },
      });

      const existingUserAchievements = await prisma.userAchievement.findMany({
        where: {
          userId,
          achievement: {
            name: { in: ["First Problem Solved", "Ten Problems Solved"] },
          },
        },
        include: { achievement: true },
      });

      const hasAchievement = (name: string) =>
        existingUserAchievements.some(
          (ua: { achievement: { name: string } }) =>
            ua.achievement.name === name,
        );

      const firstProblem = achievements.find(
        (a: { name: string }) => a.name === "First Problem Solved",
      );
      if (firstProblem && solvedCount >= 1 && !hasAchievement("First Problem Solved")) {
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: firstProblem.id,
            progressData: { totalSolved: solvedCount },
          },
        });
      }

      const tenProblems = achievements.find(
        (a: { name: string }) => a.name === "Ten Problems Solved",
      );
      if (
        tenProblems &&
        solvedCount >= 10 &&
        !hasAchievement("Ten Problems Solved")
      ) {
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: tenProblems.id,
            progressData: { totalSolved: solvedCount },
          },
        });
      }
    }

    return res.status(201).json({
      message: "Submission synced from Codeforces",
      solved,
      attemptCount,
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const isUnavailable = status === 502 || status === 503 || status === 504;
      return res.status(502).json({
        message: isUnavailable
          ? "Codeforces is temporarily unavailable. Please try again in a few minutes."
          : (err.response?.data as { comment?: string })?.comment ?? "Codeforces API error",
      });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in syncSubmissionFromCodeforces:", msg);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get user's favourite problems list (enriched with title, rating, tags for Codeforces)
export const getFavouriteProblems = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const favouriteList = await getUserFavouriteProblemsFromDB(userId);
    let cfMap: Awaited<ReturnType<typeof getCodeforcesProblemsMap>> = new Map();
    const codeforcesFavs = favouriteList.filter(
      (f: { platform: string }) => f.platform === "Codeforces"
    );
    if (codeforcesFavs.length > 0) {
      cfMap = await getCodeforcesProblemsMap();
    }
    const enriched = favouriteList.map((f: any) => {
      const base = {
        id: f.id,
        externalProblemId: f.externalProblemId,
        platform: f.platform,
        createdAt: f.createdAt,
      };
      if (f.platform === "Codeforces" && cfMap.has(f.externalProblemId)) {
        const details = cfMap.get(f.externalProblemId)!;
        return {
          ...base,
          title: details.title,
          tags: details.tags,
          rating: details.rating,
          contestId: details.contestId,
          index: details.index,
        };
      }
      return base;
    });
    return res.status(200).json(enriched);
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
