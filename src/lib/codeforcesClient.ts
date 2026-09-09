import axios from "axios";

const CF_API_BASE = "https://codeforces.com/api";
const CF_ACCEPTED = new Set(["AC", "ACCEPTED", "OK"]);
const PAGE_SIZE = 10000;
const PAGE_DELAY_MS = 400;
const MAX_PAGES = 200;
const MAX_RETRIES = 3;

export class CodeforcesApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CodeforcesApiError";
  }
}

export interface CodeforcesSubmissionRow {
  verdict?: string;
  problem?: {
    contestId?: number;
    index?: string;
    name?: string;
    id?: number;
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const code = err.code;
  return (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN"
  );
}

async function cfGet<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await axios.get(`${CF_API_BASE}${path}`, {
        params,
        timeout: 25000,
      });
      return resp.data as T;
    } catch (err) {
      lastError = err;
      if (!isRetryableNetworkError(err) || attempt === MAX_RETRIES - 1) {
        break;
      }
      await sleep(1000 * (attempt + 1));
    }
  }

  const message = axios.isAxiosError(lastError)
    ? `Codeforces API unreachable (${lastError.code ?? lastError.message})`
    : "Codeforces API request failed";
  throw new CodeforcesApiError(message, lastError);
}

/** Stable unique key for a Codeforces problem (includes gym / edge cases). */
export function codeforcesProblemKey(
  problem?: CodeforcesSubmissionRow["problem"],
): string | null {
  if (!problem) return null;
  if (typeof problem.id === "number" && problem.id > 0) {
    return `id:${problem.id}`;
  }
  if (problem.contestId != null && problem.index != null && problem.index !== "") {
    return `${problem.contestId}/${problem.index}`;
  }
  if (problem.contestId != null && problem.name) {
    return `${problem.contestId}/${problem.name}`;
  }
  if (problem.name) {
    return `name:${problem.name}`;
  }
  return null;
}

function isAcceptedVerdict(verdict?: string): boolean {
  if (!verdict) return false;
  return CF_ACCEPTED.has(verdict.trim().toUpperCase());
}

/** Fetch every submission page from Codeforces user.status. */
export async function fetchAllCodeforcesSubmissions(
  handle: string,
): Promise<CodeforcesSubmissionRow[]> {
  const all: CodeforcesSubmissionRow[] = [];
  let from = 1;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await cfGet<{ status: string; result?: CodeforcesSubmissionRow[] }>(
      "/user.status",
      { handle, from, count: PAGE_SIZE },
    );

    if (data.status !== "OK" || !Array.isArray(data.result)) {
      throw new CodeforcesApiError("Codeforces returned an invalid user.status response");
    }

    const list = data.result;
    all.push(...list);

    if (list.length < PAGE_SIZE) {
      return all;
    }

    from += list.length;
    await sleep(PAGE_DELAY_MS);
  }

  return all;
}

export function summarizeCodeforcesSubmissions(
  submissions: CodeforcesSubmissionRow[],
): {
  problemsSolved: number;
  accuracy: number | null;
  totalSubmissions: number;
  acceptedSubmissions: number;
} {
  const solvedIds = new Set<string>();
  let acceptedSubmissions = 0;

  for (const submission of submissions) {
    if (!isAcceptedVerdict(submission.verdict)) continue;
    acceptedSubmissions += 1;
    const key = codeforcesProblemKey(submission.problem);
    if (key) solvedIds.add(key);
  }

  const totalSubmissions = submissions.length;
  const accuracy =
    totalSubmissions > 0
      ? Math.round((acceptedSubmissions / totalSubmissions) * 100)
      : null;

  return {
    problemsSolved: solvedIds.size,
    accuracy,
    totalSubmissions,
    acceptedSubmissions,
  };
}

/** Fetch Codeforces user rating from user.info. Returns null on error or 502. */
export async function fetchCodeforcesUserInfo(
  handle: string,
): Promise<{ rating: number } | null> {
  try {
    const data = await cfGet<{
      status: string;
      result?: Array<{ rating?: number; maxRating?: number }>;
    }>("/user.info", { handles: handle });

    if (data.status !== "OK" || !Array.isArray(data.result) || data.result.length === 0) {
      return null;
    }

    const u = data.result[0];
    const rating = u.rating ?? u.maxRating ?? 0;
    return { rating: Number(rating) || 0 };
  } catch (err) {
    if (err instanceof CodeforcesApiError) {
      console.error("Codeforces user.info fetch failed:", err.message);
    }
    return null;
  }
}

/** Full skill summary from one complete submission scan (solved count + lifetime accuracy). */
export async function fetchCodeforcesSkillSummary(handle: string) {
  const submissions = await fetchAllCodeforcesSubmissions(handle);
  return summarizeCodeforcesSubmissions(submissions);
}

/** Count distinct accepted problems from a full Codeforces submission history. */
export async function fetchCodeforcesAcceptedCount(
  handle: string,
): Promise<number> {
  const summary = await fetchCodeforcesSkillSummary(handle);
  return summary.problemsSolved;
}

/** Lifetime submission accuracy from the full Codeforces history. */
export async function fetchCodeforcesSubmissionStats(
  handle: string,
): Promise<{ accepted: number; total: number } | null> {
  const summary = await fetchCodeforcesSkillSummary(handle);
  if (summary.totalSubmissions === 0) return null;
  return {
    accepted: summary.acceptedSubmissions,
    total: summary.totalSubmissions,
  };
}
