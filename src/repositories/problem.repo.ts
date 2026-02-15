import { prisma } from "../lib/prisma";
import puppeteer from "puppeteer";
import axios from "axios";
import { favouriteProblem } from "../types/problem.type";

export type CodeforcesProblemDetails = {
  title: string;
  tags: string[];
  rating: number | null;
  contestId: number;
  index: string;
};

const CODEFORCES_MAP_TTL_MS = 10 * 60 * 1000; // 10 minutes
let codeforcesMapCache: { map: Map<string, CodeforcesProblemDetails>; expiresAt: number } | null = null;

/** Codeforces problemId (contestId+index) -> details. Cached for 10 minutes. */
export const getCodeforcesProblemsMap = async (): Promise<
  Map<string, CodeforcesProblemDetails>
> => {
  const now = Date.now();
  if (codeforcesMapCache && codeforcesMapCache.expiresAt > now) {
    return codeforcesMapCache.map;
  }
  const resp = await axios.get(
    "https://codeforces.com/api/problemset.problems",
    { timeout: 10000 }
  );
  const data = resp.data;
  const map = new Map<string, CodeforcesProblemDetails>();
  if (data?.status === "OK") {
    const problems = data.result?.problems ?? [];
    for (const p of problems) {
      const contestId = p.contestId ?? null;
      const index = p.index ?? "";
      if (contestId != null && index) {
        map.set(`${contestId}${index}`, {
          title: p.name ?? "",
          tags: p.tags ?? [],
          rating: p.rating ?? null,
          contestId,
          index,
        });
      }
    }
  }
  codeforcesMapCache = { map, expiresAt: now + CODEFORCES_MAP_TTL_MS };
  return map;
};
export const getUserFavouriteProblemsFromDB = async (
  userId: string,
): Promise<favouriteProblem[]> => {
  const list = await prisma.favouriteProblem.findMany({
    where: { userId },
    select: {
      id: true,
      externalProblemId: true,
      platform: true,
      createdAt: true,
    },
  });
  return list;
};

export const addProblemToFavouriteDB = async (
  userId: string,
  externalProblemId: string,
  platform: string,
) => {
  await prisma.favouriteProblem.create({
    data: {
      userId: userId,
      externalProblemId: externalProblemId,
      platform: platform,
    },
  });
};

export const deleteProblemFromFavouriteDB = async (
  id: string,
): Promise<number> => {
  const recordsAffected = await prisma.favouriteProblem.delete({
    where: { id },
  });
  if (recordsAffected) return 1;
  else return 0;
};

export const checkFavouriteBelongsToUser = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const recordExist = await prisma.favouriteProblem.findFirst({
    where: { userId, id },
  });
  if (recordExist) return true;
  else return false;
};

export const checkFavouriteExistForUser = async (
  userId: string,
  externalProblemId: string,
  platform: string,
): Promise<boolean> => {
  const recordExist = await prisma.favouriteProblem.findFirst({
    where: {
      userId: userId,
      externalProblemId: externalProblemId,
      platform: platform,
    },
  });
  if (recordExist) {
    return true;
  } else return false;
};

export const getProblemFromCodeforces = async (
  contestId: number,
  index: string,
  options?: {
    headless?: boolean;
    viewport?: { width: number; height: number };
    userAgent?: string;
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
    executablePath?: string;
  },
) => {
  const {
    headless = true,
    viewport = { width: 1366, height: 768 },
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    waitUntil = "networkidle2",
    timeout = 30000,
    executablePath,
  } = options || {};

  const browser = await puppeteer.launch({
    headless,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set realistic viewport and user agent
    await page.setViewport(viewport);
    await page.setUserAgent(userAgent);

    await page.goto(
      `https://codeforces.com/problemset/problem/${contestId}/${index}`,
      {
        waitUntil,
        timeout,
      },
    );

    // Extract complete problem data using page.evaluate
    const problemData = await page.evaluate(() => {
      // Inline extraction to avoid transpiler helpers in browser context

      // Main problem statement element
      const problemStatement = document.querySelector(".problem-statement");
      if (!problemStatement) return null;

      // Header section
      const header = problemStatement.querySelector(".header");

      // Extract title and limits
      const title = (header?.querySelector(".title")?.textContent || "")
        .trim()
        .replace(/\s+/g, " ");
      const timeLimitText = (
        header?.querySelector(".time-limit")?.textContent || ""
      )
        .trim()
        .replace(/\s+/g, " ");
      const memoryLimitText = (
        header?.querySelector(".memory-limit")?.textContent || ""
      )
        .trim()
        .replace(/\s+/g, " ");
      const inputFileText = (
        header?.querySelector(".input-file")?.textContent || ""
      )
        .trim()
        .replace(/\s+/g, " ");
      const outputFileText = (
        header?.querySelector(".output-file")?.textContent || ""
      )
        .trim()
        .replace(/\s+/g, " ");

      // Parse limits
      const timeLimit = timeLimitText.replace("time limit per test", "").trim();
      const memoryLimit = memoryLimitText
        .replace("memory limit per test", "")
        .trim();
      const inputFile =
        inputFileText
          .replace("input", "")
          .replace("standard input", "")
          .trim() || "standard input";
      const outputFile =
        outputFileText
          .replace("output", "")
          .replace("standard output", "")
          .trim() || "standard output";

      // Problem content sections (text-only, no HTML tags)
      const descEl = problemStatement.querySelector(
        ".problem-statement > div:nth-child(2)",
      ) as HTMLElement | null;
      const description = (descEl?.innerText || "").trim();

      const inputSpecEl = problemStatement.querySelector(
        ".input-specification",
      ) as HTMLElement | null;
      const inputSpecification = (inputSpecEl?.innerText || "").trim();

      const outputSpecEl = problemStatement.querySelector(
        ".output-specification",
      ) as HTMLElement | null;
      const outputSpecification = (outputSpecEl?.innerText || "").trim();

      const noteEl = problemStatement.querySelector(
        ".note",
      ) as HTMLElement | null;
      const note = (noteEl?.innerText || "").trim();

      // Sample tests
      const sampleTests: Array<{ input: string; output: string }> = [];
      document.querySelectorAll(".sample-test").forEach((testElement) => {
        const inputElement = testElement.querySelector(
          ".input pre",
        ) as HTMLElement | null;
        const outputElement = testElement.querySelector(
          ".output pre",
        ) as HTMLElement | null;

        if (inputElement && outputElement) {
          sampleTests.push({
            input: (inputElement.innerText || "").trim(),
            output: (outputElement.innerText || "").trim(),
          });
        }
      });

      // Tags
      const tags: string[] = [];
      document.querySelectorAll(".tag-box").forEach((tagElement) => {
        const tagText = (tagElement?.textContent || "")
          .trim()
          .replace(/\s+/g, " ");
        if (tagText) tags.push(tagText);
      });

      // Statistics
      const statsElement = document.querySelector(".problem-stats");
      const statsText = (statsElement?.textContent || "")
        .trim()
        .replace(/\s+/g, " ");
      let solvedCount = 0;
      let attemptedCount = 0;

      if (statsText) {
        const match = statsText.match(/(\d+)\D+(\d+)/);
        if (match) {
          solvedCount = parseInt(match[1]);
          attemptedCount = parseInt(match[2]);
        }
      }

      // Difficulty rating
      let difficulty = "Unknown";
      const difficultyMatch = title.match(/\((\d+)\)/);
      if (difficultyMatch) {
        difficulty = difficultyMatch[1];
      }

      return {
        // Basic info
        title,
        timeLimit,
        memoryLimit,
        inputFile,
        outputFile,

        // Problem content
        description,
        inputSpecification,
        outputSpecification,
        sampleTests,
        note,

        // Metadata
        tags,
        difficulty,
        statistics: {
          solvedCount,
          attemptedCount,
          accuracy:
            attemptedCount > 0
              ? ((solvedCount / attemptedCount) * 100).toFixed(1)
              : 0,
        },

        // Raw HTML for flexibility (also include HTML versions)
        raw: {
          descriptionHtml: (
            problemStatement.querySelector(
              ".problem-statement > div:nth-child(2)",
            )?.innerHTML || ""
          ).trim(),
          inputSpecHtml: (
            problemStatement.querySelector(".input-specification")?.innerHTML ||
            ""
          ).trim(),
          outputSpecHtml: (
            problemStatement.querySelector(".output-specification")
              ?.innerHTML || ""
          ).trim(),
          noteHtml: (
            problemStatement.querySelector(".note")?.innerHTML || ""
          ).trim(),
        },
      };
    });

    if (!problemData) {
      throw new Error("Problem not found or cannot be parsed");
    }

    // Add contest metadata
    const enhancedData = {
      ...problemData,
      contestId,
      index,
      problemUrl: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
      fetchedAt: new Date().toISOString(),
    };

    return enhancedData;
  } finally {
    await browser.close();
  }
};

export const getExternalAccountByUserIdAndPlatform = async (
  userId: string,
  platform: string,
) => {
  return await prisma.externalAccount.findFirst({
    where: { userId, platform },
  });
};

export const createExternalSubmission = async (
  externalSubmissionId: string,
  externalAccountId: string,
  problemId: string,
  submissionTime: number,
  verdict: string,
  executionTime: number,
  memoryUsed: number,
  programmingLanguage: string,
) => {
  return await prisma.externalSubmission.create({
    data: {
      externalSubmissionId,
      externalAccountId,
      problemId,
      submissionTime,
      verdict,
      executionTime,
      memoryUsed,
      programmingLanguage,
    },
  });
};

export const upsertUserProblemAttempt = async (
  userId: string,
  externalProblemId: string,
  platform: string,
  solved: boolean,
  attemptCount: number,
  bestExecutionTime: number | null,
) => {
  return await prisma.userProblemAttempt.upsert({
    where: {
      userId_externalProblemId_platform: {
        userId,
        externalProblemId,
        platform,
      },
    },
    update: {
      attemptCount,
      solved,
      bestExecutionTime,
      lastAttempt: new Date(),
    },
    create: {
      userId,
      externalProblemId,
      platform,
      attemptCount,
      solved,
      bestExecutionTime,
      lastAttempt: new Date(),
    },
  });
};
