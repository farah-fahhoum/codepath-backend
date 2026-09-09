import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";
import axios from "axios";
import {
  getExternalAccountIntegrationFromDB,
  getCodeforcesHandleForUser,
} from "./externalAccount.repo";
import {
  getMenteeSkillProfile,
  getMenteeCodePathLevelFromProfile,
  resolveCodeforcesProblemsSolvedCount,
} from "../services/assessment.service";
import {
  countMenteesBySnapshotTierFromDB,
  getSkillLevelPreferenceFromDB,
} from "./assessment.repo";
import { getCodeforcesProblemsMap } from "./problem.repo";
import { fetchAllCodeforcesSubmissions } from "../lib/codeforcesClient";
import type { SkillLevelPreference } from "../types/assessment.type";

const CF_ACCEPTED_VERDICT_SET = new Set(["AC", "ACCEPTED", "OK"]);

function parseTagsJson(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isAcceptedVerdict(verdict?: string | null): boolean {
  if (!verdict) return false;
  return CF_ACCEPTED_VERDICT_SET.has(verdict.trim().toUpperCase());
}

function codeforcesProblemMapKey(problem?: {
  contestId?: number | null;
  index?: string | null;
}): string | null {
  if (problem?.contestId != null && problem.index) {
    return `${problem.contestId}${problem.index}`;
  }
  return null;
}

function resolveCodePrintSources(preference: SkillLevelPreference): {
  includeCodepath: boolean;
  includeCodeforces: boolean;
} {
  switch (preference) {
    case "codepath":
    case "contest":
    case "placement":
      return { includeCodepath: true, includeCodeforces: false };
    case "codeforces":
      return { includeCodepath: false, includeCodeforces: true };
    case "blended":
    case "auto":
    default:
      return { includeCodepath: true, includeCodeforces: true };
  }
}

export const getTotalMentees = async (): Promise<number> => {
  const menteeRoleId = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });
  if (!menteeRoleId) return 0;
  const totalMentees = await prisma.user.count({
    where: { roleId: menteeRoleId.id },
  });
  return totalMentees;
};

export const getTotalProblemsSolved = async (): Promise<number> => {
  const totalSolvedProblems = await prisma.userProblemAttempt.count({
    where: { solved: true },
  });
  return totalSolvedProblems;
};

export const getTotalSubmissions = async (): Promise<number> => {
  const totalSubmissionsOnPlatform = await prisma.externalSubmission.count({});
  return totalSubmissionsOnPlatform;
};

export const getMenteesTotalInEachLevel = async (): Promise<
  { level: string; total: number }[]
> => {
  return countMenteesBySnapshotTierFromDB();
};

export const getTop3PopularTopics = async (): Promise<
  { topic: string; total: number }[]
> => {
  const csvPath = path.join(__dirname, "../../problemset.csv");

  // Read the CSV file
  const csvData = fs.readFileSync(csvPath, "utf8");
  const lines = csvData.trim().split("\n").slice(1); // Skip header

  const topicCounts: Record<string, number> = {};

  // Process each line to extract and count tags
  for (const line of lines) {
    const columns = line.split(",");
    if (columns.length >= 3) {
      let tagsString = columns[2].trim();

      // Handle inconsistent CSV formatting - some arrays are not quoted
      if (!tagsString.startsWith("[") && columns.length > 3) {
        // If the tags column doesn't start with [ but there are more columns,
        // we might have split incorrectly due to unquoted arrays
        // Reconstruct the tags part by joining remaining columns
        tagsString = columns.slice(2).join(",").trim();
      }

      // Clean up the tags string for parsing
      let cleanTagsString = tagsString;

      // Remove outer quotes if present
      if (
        (cleanTagsString.startsWith('"') && cleanTagsString.endsWith('"')) ||
        (cleanTagsString.startsWith("'") && cleanTagsString.endsWith("'"))
      ) {
        cleanTagsString = cleanTagsString.slice(1, -1);
      }

      // Handle empty arrays
      if (cleanTagsString === "[]") {
        continue;
      }

      try {
        // Convert Python-style array to JSON format
        const jsonCompatible = cleanTagsString
          .replace(/\'/g, '"') // Replace single quotes with double quotes
          .replace(/\[\s*\]/g, "[]"); // Ensure empty arrays are valid JSON

        const tags = JSON.parse(jsonCompatible);

        if (Array.isArray(tags)) {
          tags.forEach((tag) => {
            if (tag && typeof tag === "string") {
              topicCounts[tag] = (topicCounts[tag] || 0) + 1;
            }
          });
        }
      } catch (error) {
        // If JSON parsing fails, try manual extraction as fallback
        const manualTags = cleanTagsString
          .replace(/\[|\]/g, "") // Remove brackets
          .split(",") // Split by commas
          .map((tag) => tag.trim().replace(/^'|"|'$|"$/g, "")) // Remove quotes
          .filter((tag) => tag.length > 0); // Filter out empty tags

        manualTags.forEach((tag) => {
          if (tag) {
            topicCounts[tag] = (topicCounts[tag] || 0) + 1;
          }
        });
      }
    }
  }

  // Convert to array and sort by count descending
  const topicsArray = Object.entries(topicCounts)
    .map(([topic, total]) => ({ topic, total }))
    .sort((a, b) => b.total - a.total);

  // Return top 3 topics
  return topicsArray.slice(0, 3);
};

export const getMenteeCodePathRating = async (
  userId: string,
): Promise<number> => {
  const profile = await getMenteeSkillProfile(userId);
  return profile.rating ?? 0;
};

export const getMenteeCodePathLevel = async (
  userId: string,
): Promise<{ tier: string; rating: number }> => {
  return getMenteeCodePathLevelFromProfile(userId);
};

export const getMenteeProblemsSolvedCount = async (
  userId: string,
): Promise<number> => {
  return resolveCodeforcesProblemsSolvedCount(userId);
};

export const getMenteeAccuracy = async (userId: string): Promise<number> => {
  const profile = await getMenteeSkillProfile(userId);
  if (
    profile.sources.codeforces.connected &&
    profile.sources.codeforces.accuracy != null
  ) {
    return profile.sources.codeforces.accuracy;
  }
  return profile.sources.codepath.accuracy;
};

/**
 * CodePrint radar data: aggregate solved problems by tag from CodePath and Codeforces.
 */
export const getMenteeCodePrintFromDB = async (
  userId: string,
  preference: SkillLevelPreference = "auto",
): Promise<Array<{ topic: string; attempts: number }>> => {
  const { includeCodepath, includeCodeforces } = resolveCodePrintSources(preference);

  const [cfHandle, cfAccount, cfMap] = await Promise.all([
    includeCodeforces ? getCodeforcesHandleForUser(userId) : Promise.resolve(null),
    includeCodeforces
      ? getExternalAccountIntegrationFromDB(userId)
      : Promise.resolve(null),
    includeCodeforces ? getCodeforcesProblemsMap() : Promise.resolve(new Map()),
  ]);

  const [
    codePathSubmissions,
    codePathAttempts,
    codeforcesAttempts,
    externalSubmissions,
  ] = await Promise.all([
    includeCodepath
      ? prisma.codePathSubmission.findMany({
          where: { userId, verdict: "AC" },
          select: { problemId: true },
        })
      : [],
    includeCodepath
      ? prisma.userProblemAttempt.findMany({
          where: { userId, platform: "CodePath", solved: true },
          select: { externalProblemId: true },
        })
      : [],
    includeCodeforces
      ? prisma.userProblemAttempt.findMany({
          where: { userId, platform: "Codeforces", solved: true },
          select: { externalProblemId: true },
        })
      : [],
    includeCodeforces && cfAccount
      ? prisma.externalSubmission.findMany({
          where: {
            externalAccountId: cfAccount.id.toString(),
            verdict: { in: ["AC", "Accepted", "OK"] },
          },
          select: { problemId: true },
        })
      : [],
  ]);

  const byTag = new Map<string, number>();

  const addForTags = (tags: string[]) => {
    for (const tag of tags) {
      const normalized = tag.trim();
      if (!normalized) continue;
      byTag.set(normalized, (byTag.get(normalized) ?? 0) + 1);
    }
  };

  if (includeCodepath) {
    const solvedCodePathIds = new Set<string>();
    for (const submission of codePathSubmissions) {
      solvedCodePathIds.add(submission.problemId);
    }
    for (const attempt of codePathAttempts) {
      solvedCodePathIds.add(attempt.externalProblemId);
    }

    if (solvedCodePathIds.size > 0) {
      const problems = await prisma.codePathProblem.findMany({
        where: { id: { in: [...solvedCodePathIds] } },
        select: { tags: true },
      });
      for (const problem of problems) {
        addForTags(parseTagsJson(problem.tags));
      }
    }
  }

  if (includeCodeforces) {
    const solvedCodeforcesIds = new Set<string>();
    for (const attempt of codeforcesAttempts) {
      solvedCodeforcesIds.add(attempt.externalProblemId);
    }
    for (const submission of externalSubmissions) {
      solvedCodeforcesIds.add(submission.problemId);
    }

    if (cfHandle) {
      try {
        const liveSubmissions = await fetchAllCodeforcesSubmissions(cfHandle);
        for (const submission of liveSubmissions) {
          if (!isAcceptedVerdict(submission.verdict)) continue;
          const key = codeforcesProblemMapKey(submission.problem);
          if (key) solvedCodeforcesIds.add(key);
        }
      } catch (error) {
        console.error("Codeforces CodePrint fetch failed:", error);
      }
    }

    for (const problemId of solvedCodeforcesIds) {
      const details = cfMap.get(problemId);
      if (details?.tags?.length) addForTags(details.tags);
    }
  }

  return Array.from(byTag.entries())
    .map(([topic, attempts]) => ({ topic, attempts }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 6);
};

export const getMenteeCodePrint = async (
  userId: string,
): Promise<Array<{ topic: string; attempts: number }>> => {
  try {
    const preference =
      (await getSkillLevelPreferenceFromDB(userId)) as SkillLevelPreference;
    return await getMenteeCodePrintFromDB(userId, preference ?? "auto");
  } catch (error) {
    console.error("Error building CodePrint from DB:", error);
    return [];
  }
};

export const getMenteeAIInsights = async (userId: string): Promise<string> => {
  const externalAccount = await getExternalAccountIntegrationFromDB(userId);
  if (!externalAccount || !externalAccount.handle) {
    return "AI insights are not available yet. Please connect your coding platform account to get personalized insights and recommendations for your learning journey.";
  }

  const fastApiBase = process.env.FASTAPI_BASE_URL?.trim();
  if (!fastApiBase) {
    return "AI insights are not available yet. Please connect your coding platform account to get personalized insights and recommendations for your learning journey.";
  }

  const userHandle = externalAccount.handle;
  const fastApiUrl = `${fastApiBase}/dashboard/ai/${userHandle}`;

  try {
    const response = await axios.get(fastApiUrl, {
      headers: { accept: "application/json" },
      timeout: 10000,
    });
    return response.data.ai_insight ?? "AI insights are not available yet. Please connect your coding platform account to get personalized insights and recommendations for your learning journey.";
  } catch (axiosError) {
    if (axios.isAxiosError(axiosError)) {
      if (axiosError.code === "ECONNREFUSED") {
        return "AI insights service is currently unavailable. Connect your coding platform account for personalized insights when the service is available.";
      }
      if (axiosError.response) {
        return `AI insights temporarily unavailable (${axiosError.response.status}). Try again later or connect your coding platform account.`;
      }
      if (axiosError.request) {
        return "AI insights service request timeout. Try again later.";
      }
    }
    return "AI insights are not available right now. Please connect your coding platform account and try again later.";
  }
};

/** Pad number to 2 digits for date string */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const CF_STATUS_PAGE_SIZE = 1000;
const CF_STATUS_MAX_PAGES = 20; // cap to avoid rate limits / long waits

/**
 * Fetch activity by date from Codeforces API (user.status) for the given handle and year.
 * API returns newest-first; we paginate until we have all submissions in the year or pass it.
 * Returns record of date string -> count. Does not throw; returns {} on API error.
 */
async function getCodeforcesActivityByDate(
  handle: string,
  year: number,
): Promise<Record<string, number>> {
  const startTs = Math.floor(new Date(year, 0, 1).getTime() / 1000);
  const endTs = Math.floor(
    new Date(year, 11, 31, 23, 59, 59).getTime() / 1000,
  );
  const byDate: Record<string, number> = {};
  try {
    let from = 1;
    let hasReachedPastYear = false;

    for (let page = 0; page < CF_STATUS_MAX_PAGES; page++) {
      const resp = await axios.get("https://codeforces.com/api/user.status", {
        params: { handle, from, count: CF_STATUS_PAGE_SIZE },
        timeout: 12000,
      });
      if (!resp.data?.result || resp.data.status !== "OK") break;
      const list = resp.data.result as Array<{ creationTimeSeconds?: number }>;
      if (list.length === 0) break;

      for (const s of list) {
        const ts = s.creationTimeSeconds;
        if (ts == null) continue;
        if (ts < startTs) {
          hasReachedPastYear = true;
          break;
        }
        if (ts > endTs) continue;
        const d = new Date(ts * 1000);
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        byDate[key] = (byDate[key] ?? 0) + 1;
      }

      if (hasReachedPastYear) break;
      if (list.length < CF_STATUS_PAGE_SIZE) break;
      from += list.length;
      // Avoid hammering the API
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const msg = (err as Error)?.message;
    console.error("Codeforces activity fetch failed:", status ?? msg ?? "unknown");
  }
  return byDate;
}

export interface ActivityByDateBreakdown {
  codeprint: Record<string, number>;
  codeforces: Record<string, number>;
}

function incrementDateCount(
  target: Record<string, number>,
  date: Date,
): void {
  const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  target[key] = (target[key] ?? 0) + 1;
}

/**
 * Activity by date for consistency tracker.
 * CodePrint: CodePath submissions, problem attempts, and non-CF external submissions.
 * Codeforces: live submissions from the linked Codeforces handle.
 */
export const getActivityByDateForUser = async (
  userId: string,
  year: number,
): Promise<ActivityByDateBreakdown> => {
  const startTs = Math.floor(new Date(year, 0, 1).getTime() / 1000);
  const endTs = Math.floor(
    new Date(year, 11, 31, 23, 59, 59).getTime() / 1000,
  );
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const accounts = await prisma.externalAccount.findMany({
    where: { userId },
    select: { id: true, platform: true, handle: true },
  });
  const codeforcesAccount = accounts.find((a) => a.platform === "Codeforces");
  const nonCfAccountIds = accounts
    .filter((a) => a.platform !== "Codeforces")
    .map((a) => a.id.toString());

  const [externalSubmissions, attempts, codePathSubmissions, cfActivity] =
    await Promise.all([
      nonCfAccountIds.length > 0
        ? prisma.externalSubmission.findMany({
            where: {
              externalAccountId: { in: nonCfAccountIds },
              submissionTime: { gte: startTs, lte: endTs },
            },
            select: { submissionTime: true },
          })
        : [],
      prisma.userProblemAttempt.findMany({
        where: {
          userId,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { createdAt: true },
      }),
      prisma.codePathSubmission.findMany({
        where: {
          userId,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { createdAt: true },
      }),
      codeforcesAccount?.handle
        ? getCodeforcesActivityByDate(codeforcesAccount.handle, year)
        : Promise.resolve({} as Record<string, number>),
    ]);

  const codeprint: Record<string, number> = {};

  for (const submission of externalSubmissions) {
    incrementDateCount(codeprint, new Date(submission.submissionTime * 1000));
  }
  for (const attempt of attempts) {
    incrementDateCount(codeprint, new Date(attempt.createdAt));
  }
  for (const submission of codePathSubmissions) {
    incrementDateCount(codeprint, new Date(submission.createdAt));
  }

  return {
    codeprint,
    codeforces: cfActivity,
  };
};

export interface GrowthSourceMonthStat {
  submissions: number;
  problemsSolved: number;
}

export interface MonthStat {
  year: number;
  month: number;
  monthLabel: string;
  codeprint: GrowthSourceMonthStat;
  codeforces: GrowthSourceMonthStat;
}

type MonthlyGrowthBucket = {
  submissions: number;
  solvedIds: Set<string>;
};

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function ensureMonthBucket(
  map: Map<string, MonthlyGrowthBucket>,
  key: string,
): MonthlyGrowthBucket {
  if (!map.has(key)) {
    map.set(key, { submissions: 0, solvedIds: new Set() });
  }
  return map.get(key)!;
}

/**
 * Fetch monthly growth (submissions + distinct accepted problems per month) from Codeforces API.
 * Paginates user.status and groups by month. Returns Map of "YYYY-MM" -> { submissions, solvedIds }.
 */
async function getCodepathMonthlyGrowth(
  userId: string,
): Promise<Map<string, MonthlyGrowthBucket>> {
  const byMonth = new Map<string, MonthlyGrowthBucket>();

  const submissions = await prisma.codePathSubmission.findMany({
    where: { userId },
    select: { createdAt: true, problemId: true, verdict: true },
  });

  for (const submission of submissions) {
    const key = monthKeyFromDate(new Date(submission.createdAt));
    const entry = ensureMonthBucket(byMonth, key);
    entry.submissions += 1;
    if (submission.verdict === "AC") {
      entry.solvedIds.add(submission.problemId);
    }
  }

  return byMonth;
}

async function getCodeforcesMonthlyGrowth(
  handle: string,
): Promise<Map<string, MonthlyGrowthBucket>> {
  const byMonth = new Map<string, MonthlyGrowthBucket>();
  try {
    let from = 1;
    for (let page = 0; page < CF_STATUS_MAX_PAGES; page++) {
      const resp = await axios.get("https://codeforces.com/api/user.status", {
        params: { handle, from, count: CF_STATUS_PAGE_SIZE },
        timeout: 12000,
      });
      if (!resp.data?.result || resp.data.status !== "OK") break;
      const list = resp.data.result as Array<{
        creationTimeSeconds?: number;
        verdict?: string;
        problem?: { contestId?: number; index?: string };
      }>;
      if (list.length === 0) break;

      for (const s of list) {
        const ts = s.creationTimeSeconds;
        if (ts == null) continue;
        const d = new Date(ts * 1000);
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        if (!byMonth.has(key)) {
          byMonth.set(key, { submissions: 0, solvedIds: new Set() });
        }
        const entry = byMonth.get(key)!;
        entry.submissions += 1;
        const problemId =
          s.problem?.contestId != null && s.problem?.index != null
            ? `${s.problem.contestId}${s.problem.index}`
            : null;
        if (problemId && isAcceptedVerdict(s.verdict)) {
          entry.solvedIds.add(problemId);
        }
      }

      if (list.length < CF_STATUS_PAGE_SIZE) break;
      from += list.length;
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const msg = (err as Error)?.message;
    console.error("Codeforces monthly growth fetch failed:", status ?? msg ?? "unknown");
  }
  return byMonth;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Monthly growth stats split by CodePath platform submissions and Codeforces history.
 */
export const getMonthlyGrowthForUser = async (
  userId: string,
): Promise<MonthStat[]> => {
  const cfHandle = await getCodeforcesHandleForUser(userId);

  const [codeprintMonthly, codeforcesMonthly] = await Promise.all([
    getCodepathMonthlyGrowth(userId),
    cfHandle
      ? getCodeforcesMonthlyGrowth(cfHandle)
      : Promise.resolve(new Map<string, MonthlyGrowthBucket>()),
  ]);

  const allKeys = new Set([
    ...codeprintMonthly.keys(),
    ...codeforcesMonthly.keys(),
  ]);

  return Array.from(allKeys)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const [yearStr, monthStr] = key.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const codeprint = codeprintMonthly.get(key) ?? {
        submissions: 0,
        solvedIds: new Set<string>(),
      };
      const codeforces = codeforcesMonthly.get(key) ?? {
        submissions: 0,
        solvedIds: new Set<string>(),
      };

      return {
        year,
        month,
        monthLabel: `${MONTH_LABELS[month - 1] ?? ""} ${year}`,
        codeprint: {
          submissions: codeprint.submissions,
          problemsSolved: codeprint.solvedIds.size,
        },
        codeforces: {
          submissions: codeforces.submissions,
          problemsSolved: codeforces.solvedIds.size,
        },
      };
    });
};
