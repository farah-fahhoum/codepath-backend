import { prisma } from "../lib/prisma";
import type { ProblemAttemptSource } from "../types/assessment.type";
import { refreshSkillSnapshotFast, scheduleFullSkillSnapshotRefresh } from "../services/assessment.service";
import {
  syncRoadmapAchievementsForUser,
  syncRoadmapProgressForUser,
} from "./roadmap.repo";

export async function recordProblemAttempt(params: {
  userId: string;
  externalProblemId: string;
  platform: string;
  solved: boolean;
  source: ProblemAttemptSource;
  executionTimeMs?: number | null;
}): Promise<void> {
  const {
    userId,
    externalProblemId,
    platform,
    solved,
    source,
    executionTimeMs,
  } = params;

  const existing = await prisma.userProblemAttempt.findUnique({
    where: {
      userId_externalProblemId_platform: {
        userId,
        externalProblemId,
        platform,
      },
    },
  });

  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  const bestExecutionTime =
    solved && executionTimeMs != null
      ? Math.min(existing?.bestExecutionTime ?? Infinity, executionTimeMs)
      : existing?.bestExecutionTime ?? null;

  await prisma.userProblemAttempt.upsert({
    where: {
      userId_externalProblemId_platform: {
        userId,
        externalProblemId,
        platform,
      },
    },
    create: {
      userId,
      externalProblemId,
      platform,
      source,
      solved: solved || (existing?.solved ?? false),
      attemptCount,
      bestExecutionTime:
        bestExecutionTime === Infinity ? null : bestExecutionTime,
      lastAttempt: new Date(),
    },
    update: {
      source,
      solved: solved || existing?.solved || false,
      attemptCount,
      bestExecutionTime:
        bestExecutionTime === Infinity ? null : bestExecutionTime,
      lastAttempt: new Date(),
    },
  });

  try {
    await refreshSkillSnapshotFast(userId);
    scheduleFullSkillSnapshotRefresh(userId);
  } catch (err) {
    console.error("[recordProblemAttempt] refreshSkillSnapshot failed:", err);
  }

  if (solved) {
    try {
      await syncRoadmapProgressForUser(userId);
      await syncRoadmapAchievementsForUser(userId);
    } catch (err) {
      console.error("[recordProblemAttempt] roadmap sync failed:", err);
    }
  }
}
