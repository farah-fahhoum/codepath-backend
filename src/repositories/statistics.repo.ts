import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";
import axios from "axios";
import { getExternalAccountIntegrationFromDB } from "./externalAccount.repo";

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
  const totalSolvedProblems = await prisma.userSkillAssessment.findFirst({
    where: { userId: userId },
    select: { score: true },
  });
  return totalSolvedProblems?.score || 0;
};

export const getMenteeCodePathLevel = async (
  userId: string,
): Promise<{ tier: string; rating: number }> => {
  // Get user handle from external account
  const externalAccount = await getExternalAccountIntegrationFromDB(userId);
  if (!externalAccount || !externalAccount.handle) {
    return { tier: "Not Assessed", rating: 0 };
  }

  const userHandle = externalAccount.handle;

  try {
    // Call FastAPI endpoint to get user dashboard data
    const response = await axios.get(
      `${process.env.FASTAPI_BASE_URL}/dashboard/user/${userHandle}`,
      {
        headers: {
          accept: "application/json",
        },
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

    // Fallback to database if FastAPI fails
    const skillAssessment = await prisma.userSkillAssessment.findFirst({
      where: { userId: userId },
      select: { skillLevel: { select: { title: true } } },
    });

    return {
      tier: skillAssessment?.skillLevel?.title || "Not Assessed",
      rating: 0,
    };
  }
};

export const getMenteeProblemsSolvedCount = async (
  userId: string,
): Promise<number> => {
  const totalSolvedProblems = await prisma.userProblemAttempt.count({
    where: { userId: userId, solved: true },
  });
  return totalSolvedProblems;
};

export const getMenteeAccuracy = async (userId: string): Promise<number> => {
  const totalAttemptedProblems = await prisma.userProblemAttempt.count({
    where: { userId: userId },
  });
  const totalSolvedProblems = await getMenteeProblemsSolvedCount(userId);

  if (totalAttemptedProblems === 0) return 0;

  return (totalSolvedProblems / totalAttemptedProblems) * 100;
};

export const getMenteeCodePrint = async (
  userId: string,
): Promise<Array<{ topic: string; attempts: number }>> => {
  const externalAccount = await getExternalAccountIntegrationFromDB(userId);
  if (!externalAccount || !externalAccount.handle) {
    return [];
  }

  const userHandle = externalAccount.handle;

  try {
    // Call FastAPI endpoint to get radar data
    const response = await axios.get(
      `${process.env.FASTAPI_BASE_URL}/dashboard/radar/${userHandle}`,
      {
        headers: {
          accept: "application/json",
        },
        timeout: 10000,
      },
    );

    const radarData = response.data;

    const topTopics = Object.entries(radarData.top_topics || {})
      .map(([topic, attempts]) => ({
        topic,
        attempts: typeof attempts === "number" ? attempts : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 6);

    return topTopics;
  } catch (error) {
    console.error("Error fetching radar data from FastAPI:", error);
    return [];
  }
};

export const getMenteeAIInsights = async (userId: string): Promise<string> => {
  const externalAccount = await getExternalAccountIntegrationFromDB(userId);
  if (!externalAccount || !externalAccount.handle) {
    return "AI insights are not available yet. Please connect your coding platform account to get personalized insights and recommendations for your learning journey.";
  }

  const userHandle = externalAccount.handle;

  // Make API call to FastAPI dashboard service
  const fastApiUrl =
    process.env.FASTAPI_BASE_URL + `/dashboard/ai/${userHandle}`;

  try {
    const response = await axios.get(fastApiUrl, {
      headers: {
        accept: "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    // Return the AI insight from the response
    return response.data.ai_insight;
  } catch (axiosError) {
    if (axios.isAxiosError(axiosError)) {
      if (axiosError.code === "ECONNREFUSED") {
        throw new Error("AI insights service is currently unavailable");
      } else if (axiosError.response) {
        // Forward the error response from FastAPI
        throw new Error(
          `AI insights service error: ${axiosError.response.status} ${axiosError.response.statusText}`,
        );
      } else if (axiosError.request) {
        throw new Error("AI insights service request timeout");
      }
    }

    throw new Error(
      `Error communicating with AI insights service: ${axiosError.message}`,
    );
  }
};
