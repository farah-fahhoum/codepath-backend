import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";
import axios from "axios";
import {
  getExternalAccountIntegrationFromDB,
  getCodeforcesHandleForUser,
} from "./externalAccount.repo";
import { getCodeforcesProblemsMap } from "./problem.repo";

const CF_API_BASE = "https://codeforces.com/api";
const CF_ACCEPTED = ["AC", "Accepted", "OK"];

/** Fetch Codeforces user rating from user.info. Returns null on error or 502. */
async function fetchCodeforcesUserInfo(
  handle: string,
): Promise<{ rating: number } | null> {
  try {
    const resp = await axios.get(`${CF_API_BASE}/user.info`, {
      params: { handles: handle },
      timeout: 10000,
    });
    if (resp.data?.status !== "OK" || !Array.isArray(resp.data?.result) || resp.data.result.length === 0)
      return null;
    const u = resp.data.result[0];
    const rating = u.rating ?? u.maxRating ?? 0;
    return { rating: Number(rating) || 0 };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== undefined)
      console.error("Codeforces user.info fetch failed:", status);
    return null;
  }
}

/** Count distinct accepted problems from Codeforces user.status (paginated). */
async function fetchCodeforcesAcceptedCount(handle: string): Promise<number> {
  const solvedIds = new Set<string>();
  try {
    let from = 1;
    for (let page = 0; page < 5; page++) {
      const resp = await axios.get(`${CF_API_BASE}/user.status`, {
        params: { handle, from, count: 1000 },
        timeout: 12000,
      });
      if (resp.data?.status !== "OK" || !Array.isArray(resp.data?.result))
        break;
      const list = resp.data.result as Array<{
        verdict?: string;
        problem?: { contestId?: number; index?: string };
      }>;
      for (const s of list) {
        if (s.verdict && CF_ACCEPTED.includes(s.verdict) && s.problem?.contestId != null && s.problem?.index != null)
          solvedIds.add(`${s.problem.contestId}${s.problem.index}`);
      }
      if (list.length < 1000) break;
      from += list.length;
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== undefined)
      console.error("Codeforces user.status fetch failed:", status);
  }
  return solvedIds.size;
}

/** Total submissions and accepted count from Codeforces (one page for accuracy). */
async function fetchCodeforcesSubmissionStats(
  handle: string,
): Promise<{ accepted: number; total: number } | null> {
  try {
    const resp = await axios.get(`${CF_API_BASE}/user.status`, {
      params: { handle, from: 1, count: 1000 },
      timeout: 12000,
    });
    if (resp.data?.status !== "OK" || !Array.isArray(resp.data?.result))
      return null;
    const list = resp.data.result as Array<{ verdict?: string }>;
    const accepted = list.filter((s) => s.verdict && CF_ACCEPTED.includes(s.verdict)).length;
    return { accepted, total: list.length };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== undefined)
      console.error("Codeforces user.status (stats) fetch failed:", status);
    return null;
  }
}

function tierFromCodeforcesRating(rating: number): string {
  if (rating < 1200) return "Beginner";
  if (rating < 1400) return "Intermediate";
  if (rating < 1600) return "Advanced";
  if (rating < 1900) return "Expert";
  return "Master";
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
  // First, get all skill levels from the database
  const skillLevels = await prisma.skillLevel.findMany({
    select: { id: true, title: true },
  });

  // Get the mentee role ID
  const menteeRole = await prisma.role.findFirst({
    where: { title: "Mentee" },
    select: { id: true },
  });

  if (!menteeRole) {
    return skillLevels.map((level) => ({ level: level.title, total: 0 }));
  }

  // For each skill level, count the number of mentees with that skill level
  const results = await Promise.all(
    skillLevels.map(async (level) => {
      const menteeCount = await prisma.userSkillAssessment.count({
        where: {
          skillLevelId: level.id,
          user: {
            roleId: menteeRole.id,
          },
        },
      });
      return {
        level: level.title,
        total: menteeCount,
      };
    }),
  );

  return results;
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
  const cfHandle = await getCodeforcesHandleForUser(userId);
  if (cfHandle) {
    const info = await fetchCodeforcesUserInfo(cfHandle);
    if (info != null) return info.rating;
  }
  const totalSolvedProblems = await prisma.userSkillAssessment.findFirst({
    where: { userId: userId },
    select: { score: true },
  });
  return totalSolvedProblems?.score || 0;
};

export const getMenteeCodePathLevel = async (
  userId: string,
): Promise<{ tier: string; rating: number }> => {
  // Prefer Codeforces when handle is linked
  const cfHandle = await getCodeforcesHandleForUser(userId);
  if (cfHandle) {
    const info = await fetchCodeforcesUserInfo(cfHandle);
    if (info != null)
      return { tier: tierFromCodeforcesRating(info.rating), rating: info.rating };
  }

  // Fallback: other external account + FastAPI
  const externalAccount = await getExternalAccountIntegrationFromDB(userId);
  if (externalAccount?.handle) {
    const userHandle = externalAccount.handle;
    const fastApiBase = process.env.FASTAPI_BASE_URL?.trim();
    if (fastApiBase) {
      try {
        const response = await axios.get(
          `${fastApiBase}/dashboard/user/${userHandle}`,
          {
            headers: { accept: "application/json" },
            timeout: 10000,
          },
        );
        const userData = response.data;
        return {
          tier: userData.tier || "Not Assessed",
          rating: userData.rating || 0,
        };
      } catch (error) {
        console.error("Error fetching user tier from FastAPI:", error);
      }
    }
  }

  const skillAssessment = await prisma.userSkillAssessment.findFirst({
    where: { userId: userId },
    select: { skillLevel: { select: { title: true } } },
  });
  return {
    tier: skillAssessment?.skillLevel?.title || "Not Assessed",
    rating: 0,
  };
};

export const getMenteeProblemsSolvedCount = async (
  userId: string,
): Promise<number> => {
  const cfHandle = await getCodeforcesHandleForUser(userId);
  if (cfHandle) {
    const cfCount = await fetchCodeforcesAcceptedCount(cfHandle);
    return cfCount;
  }
  const totalSolvedProblems = await prisma.userProblemAttempt.count({
    where: { userId: userId, solved: true },
  });
  return totalSolvedProblems;
};

export const getMenteeAccuracy = async (userId: string): Promise<number> => {
  const cfHandle = await getCodeforcesHandleForUser(userId);
  if (cfHandle) {
    const stats = await fetchCodeforcesSubmissionStats(cfHandle);
    if (stats != null && stats.total > 0)
      return Math.round((stats.accepted / stats.total) * 100);
  }
  const totalAttemptedProblems = await prisma.userProblemAttempt.count({
    where: { userId: userId },
  });
  const totalSolvedProblems = await prisma.userProblemAttempt.count({
    where: { userId: userId, solved: true },
  });
  if (totalAttemptedProblems === 0) return 0;
  return Math.round((totalSolvedProblems / totalAttemptedProblems) * 100);
};

/**
 * CodePrint from DB + Codeforces: aggregate user's submissions and attempts by tag.
 */
export const getMenteeCodePrintFromDB = async (
  userId: string,
): Promise<Array<{ topic: string; attempts: number }>> => {
  const accounts = await prisma.externalAccount.findMany({
    where: { userId, platform: "Codeforces" },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id.toString());

  const [submissions, attempts, cfMap] = await Promise.all([
    accountIds.length > 0
      ? prisma.externalSubmission.findMany({
          where: { externalAccountId: { in: accountIds } },
          select: { problemId: true },
        })
      : [],
    prisma.userProblemAttempt.findMany({
      where: { userId, platform: "Codeforces" },
      select: { externalProblemId: true, attemptCount: true },
    }),
    getCodeforcesProblemsMap(),
  ]);

  const byTag = new Map<string, number>();

  const addForTags = (tags: string[], weight: number) => {
    for (const tag of tags) {
      if (tag && tag.trim()) {
        const t = tag.trim();
        byTag.set(t, (byTag.get(t) ?? 0) + weight);
      }
    }
  };

  for (const s of submissions) {
    const details = cfMap.get(s.problemId);
    if (details?.tags?.length) addForTags(details.tags, 1);
  }
  for (const a of attempts) {
    const details = cfMap.get(a.externalProblemId);
    if (details?.tags?.length) {
      const weight = Math.max(1, a.attemptCount);
      addForTags(details.tags, weight);
    }
  }

  const sorted = Array.from(byTag.entries())
    .map(([topic, attempts]) => ({ topic, attempts }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 6);

  return sorted;
};

export const getMenteeCodePrint = async (
  userId: string,
): Promise<Array<{ topic: string; attempts: number }>> => {
  try {
    return await getMenteeCodePrintFromDB(userId);
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

/**
 * Activity by date for consistency tracker.
 * Uses: ExternalSubmission (non-Codeforces), UserProblemAttempt (createdAt), and
 * Codeforces API (user.status) for the user's CF handle when linked.
 */
export const getActivityByDateForUser = async (
  userId: string,
  year: number,
): Promise<Record<string, number>> => {
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

  const [submissions, attempts, cfActivity] = await Promise.all([
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
    codeforcesAccount?.handle
      ? getCodeforcesActivityByDate(codeforcesAccount.handle, year)
      : Promise.resolve({} as Record<string, number>),
  ]);

  const byDate: Record<string, number> = {};

  for (const s of submissions) {
    const d = new Date(s.submissionTime * 1000);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    byDate[key] = (byDate[key] ?? 0) + 1;
  }
  for (const a of attempts) {
    const d = new Date(a.createdAt);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    byDate[key] = (byDate[key] ?? 0) + 1;
  }
  for (const [key, count] of Object.entries(cfActivity)) {
    byDate[key] = (byDate[key] ?? 0) + count;
  }

  return byDate;
};

export interface MonthStat {
  year: number;
  month: number;
  monthLabel: string;
  submissions: number;
  problemsSolved: number;
}

const CF_ACCEPTED_VERDICTS = ["AC", "Accepted", "OK"];

/**
 * Fetch monthly growth (submissions + distinct accepted problems per month) from Codeforces API.
 * Paginates user.status and groups by month. Returns Map of "YYYY-MM" -> { submissions, solvedIds }.
 */
async function getCodeforcesMonthlyGrowth(
  handle: string,
): Promise<Map<string, { submissions: number; solvedIds: Set<string> }>> {
  const byMonth = new Map<string, { submissions: number; solvedIds: Set<string> }>();
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
        if (
          problemId &&
          s.verdict &&
          CF_ACCEPTED_VERDICTS.includes(s.verdict)
        ) {
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
 * Monthly growth stats from ExternalSubmission (non-Codeforces) and Codeforces API when user has linked CF.
 */
export const getMonthlyGrowthForUser = async (
  userId: string,
): Promise<MonthStat[]> => {
  const accounts = await prisma.externalAccount.findMany({
    where: { userId },
    select: { id: true, platform: true, handle: true },
  });
  const codeforcesAccount = accounts.find((a) => a.platform === "Codeforces");
  const nonCfAccountIds = accounts
    .filter((a) => a.platform !== "Codeforces")
    .map((a) => a.id.toString());

  const acceptedVerdicts = ["AC", "Accepted", "OK"];
  const byMonth = new Map<
    string,
    { submissions: number; solvedIds: Set<string> }
  >();

  const addToMonth = (
    key: string,
    submissions: number,
    problemId: string | null,
    accepted: boolean,
  ) => {
    if (!byMonth.has(key)) {
      byMonth.set(key, { submissions: 0, solvedIds: new Set() });
    }
    const entry = byMonth.get(key)!;
    entry.submissions += submissions;
    if (accepted && problemId) entry.solvedIds.add(problemId);
  };

  const [dbSubmissions, cfMonthly] = await Promise.all([
    nonCfAccountIds.length > 0
      ? prisma.externalSubmission.findMany({
          where: { externalAccountId: { in: nonCfAccountIds } },
          select: {
            submissionTime: true,
            problemId: true,
            verdict: true,
          },
        })
      : [],
    codeforcesAccount?.handle
      ? getCodeforcesMonthlyGrowth(codeforcesAccount.handle)
      : Promise.resolve(
          new Map<string, { submissions: number; solvedIds: Set<string> }>(),
        ),
  ]);

  for (const s of dbSubmissions) {
    const d = new Date(s.submissionTime * 1000);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    addToMonth(
      key,
      1,
      s.problemId,
      acceptedVerdicts.includes(s.verdict),
    );
  }

  for (const [key, val] of cfMonthly.entries()) {
    if (!byMonth.has(key)) {
      byMonth.set(key, { submissions: 0, solvedIds: new Set() });
    }
    const entry = byMonth.get(key)!;
    entry.submissions += val.submissions;
    for (const id of val.solvedIds) entry.solvedIds.add(id);
  }

  const sorted = Array.from(byMonth.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return sorted.map(([key, val]) => {
    const [y, m] = key.split("-").map(Number);
    return {
      year: y,
      month: m,
      monthLabel: `${MONTH_LABELS[m - 1]} ${y}`,
      submissions: val.submissions,
      problemsSolved: val.solvedIds.size,
    };
  });
};
