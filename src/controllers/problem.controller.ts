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
  listCodeforcesProblemsFromAPI,
} from "../repositories/problem.repo";
import { recordProblemAttempt } from "../repositories/userProblemAttempt.repo";
import {
  getCodePathProblemByIdFromDB,
  getPublishedCodePathProblemsByIdsFromDB,
} from "../repositories/codepathProblem.repo";
import {
  CodeExecutionError,
  defaultExecutionProvider,
} from "../services/execution";
import { problemListQuerySchema } from "../lib/problemListQuery";

export const getProblems = async (req: Request, res: Response) => {
  try {
    const { value, error } = problemListQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const result = await listCodeforcesProblemsFromAPI({
      page: value.page,
      limit: value.limit,
      minRating: value.minRating,
      maxRating: value.maxRating,
      tag: value.tag,
      search: value.search,
      sort: value.sort,
    });

    return res.status(200).json({
      page: value.page,
      limit: value.limit,
      total: result.total,
      totalPages: result.totalPages,
      items: result.items,
      availableTags: result.availableTags,
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

    const result = await defaultExecutionProvider.execute({
      language: value.language,
      code: value.code,
      stdin: value.stdin ?? "",
    });

    const stdout = result.run.stdout ?? "";
    const stderr = [
      result.compile?.stderr,
      result.run.stderr,
    ]
      .filter((s) => s && String(s).trim().length > 0)
      .join("\n");
    const combined =
      stderr.trim().length > 0 ? `${stderr}\n${stdout}` : stdout;

    return res.status(200).json({
      stdout,
      stderr,
      output: combined,
      code: result.run.code,
      signal: result.run.signal ?? null,
    });
  } catch (err) {
    if (err instanceof CodeExecutionError) {
      return res.status(err.statusCode).json({ message: err.message });
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

    try {
      const data = await getProblemFromCodeforces(value.contestId, value.index, {
        executablePath: execPath,
      });
      return res.status(200).json(data);
    } catch (scrapeError) {
      const errMsg =
        scrapeError instanceof Error
          ? scrapeError.message
          : String(scrapeError);
      console.error(
        `[getProblem] scrape failed for ${value.contestId}/${value.index}:`,
        errMsg,
      );

      // Cloudflare often blocks headless Chrome. Fall back to CF API metadata
      // so the UI can still show title/tags/rating + an external link.
      const fallback = await getProblemMetadataFallback(
        value.contestId,
        value.index,
        errMsg,
      );
      return res.status(200).json(fallback);
    }
  } catch (error) {
    console.error("[getProblem] unexpected error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
};

async function getProblemMetadataFallback(
  contestId: number,
  index: string,
  reason: string,
) {
  const problemUrl = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  let title = `${index}`;
  let tags: string[] = [];
  let rating: number | null = null;

  try {
    const resp = await axios.get(
      "https://codeforces.com/api/problemset.problems",
      { timeout: 10000 },
    );
    if (resp.data?.status === "OK") {
      const match = (resp.data.result?.problems ?? []).find(
        (p: { contestId?: number; index?: string }) =>
          p.contestId === contestId &&
          String(p.index).toUpperCase() === String(index).toUpperCase(),
      );
      if (match) {
        title = `${match.index}. ${match.name}`;
        tags = match.tags ?? [];
        rating = match.rating ?? null;
      }
    }
  } catch (apiError) {
    console.error("[getProblem] CF API metadata fallback failed:", apiError);
  }

  const blockedByCloudflare = /cloudflare|just a moment|403/i.test(reason);

  return {
    title,
    timeLimit: "Unknown",
    memoryLimit: "Unknown",
    inputFile: "standard input",
    outputFile: "standard output",
    description: blockedByCloudflare
      ? "Codeforces blocked automated access to the problem statement (Cloudflare). Open the problem on Codeforces to read the full statement."
      : `Problem statement could not be scraped (${reason}). Open the problem on Codeforces.`,
    inputSpecification: "",
    outputSpecification: "",
    sampleTests: [] as Array<{ input: string; output: string }>,
    note: "",
    tags,
    difficulty: rating != null ? String(rating) : "Unknown",
    statistics: { solvedCount: 0, attemptedCount: 0, accuracy: 0 },
    raw: {
      descriptionHtml: "",
      inputSpecHtml: "",
      outputSpecHtml: "",
      noteHtml: "",
    },
    contestId,
    index,
    problemUrl,
    fetchedAt: new Date().toISOString(),
    scrapeFailed: true,
    scrapeError: blockedByCloudflare
      ? "Cloudflare challenge blocked Puppeteer"
      : reason,
  };
}

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

    await recordProblemAttempt({
      userId,
      externalProblemId: value.problemId,
      platform: value.platform,
      solved,
      source: "external_sync",
      executionTimeMs: value.executionTime ?? null,
    });

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

    await recordProblemAttempt({
      userId,
      externalProblemId: problemId,
      platform: "Codeforces",
      solved,
      source: "external_sync",
      executionTimeMs: executionTime || null,
    });

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

// Get user's favourite problems list (enriched with title, rating, tags)
export const getFavouriteProblems = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const favouriteList = await getUserFavouriteProblemsFromDB(userId);

    const codeforcesFavs = favouriteList.filter(
      (f: { platform: string }) => f.platform === "Codeforces",
    );
    const codepathFavs = favouriteList.filter(
      (f: { platform: string }) => f.platform === "CodePath",
    );

    let cfMap: Awaited<ReturnType<typeof getCodeforcesProblemsMap>> = new Map();
    if (codeforcesFavs.length > 0) {
      cfMap = await getCodeforcesProblemsMap();
    }

    const codepathRows =
      codepathFavs.length > 0
        ? await getPublishedCodePathProblemsByIdsFromDB(
            codepathFavs.map((f: { externalProblemId: string }) => f.externalProblemId),
          )
        : [];
    const codepathMap = new Map(codepathRows.map((p) => [p.id, p]));

    const parseTags = (tagsJson: string): string[] => {
      try {
        const parsed = JSON.parse(tagsJson);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    };

    const enriched = favouriteList.map((f: { id: string; externalProblemId: string; platform: string; createdAt: Date }) => {
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
      if (f.platform === "CodePath" && codepathMap.has(f.externalProblemId)) {
        const details = codepathMap.get(f.externalProblemId)!;
        return {
          ...base,
          title: details.title,
          tags: parseTags(details.tags),
          rating: details.rating,
          slug: details.slug,
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
      platform: Joi.string().valid("Codeforces", "LeetCode", "CodePath").required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { externalProblemId, platform } = value;

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (platform === "CodePath") {
      const problem = await getCodePathProblemByIdFromDB(externalProblemId);
      if (!problem || problem.status !== "PUBLISHED") {
        return res.status(404).json({
          message: "CodePath problem not found or not published",
        });
      }
    }

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
