import { Request, Response } from "express";
import {
  upsertExternalAccount,
  getExternalAccountIntegrationFromDB,
  verifyCodeforcesHandleExists,
  deleteExternalAccountForUser,
} from "../repositories/externalAccount.repo";
import { getMenteeCodePathLevel } from "../repositories/statistics.repo";
import { activateRoadmapForUserSkillProfile } from "../repositories/roadmap.repo";
import {
  prepareLevelChoiceAfterCfConnect,
  prepareLevelChoiceAfterDisconnect,
  refreshSkillSnapshotFast,
} from "../services/assessment.service";
import { checkUserRoleForAuth } from "../repositories/user.repo";

export const cfIntegrationOnRegisteration = async (
  req: Request,
  res: Response,
) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    const { handle } = req.body;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not authenticated" });
    }

    if (!handle || typeof handle !== "string" || !handle.trim()) {
      return res
        .status(400)
        .json({ message: "Bad Request: Handle is required" });
    }

    const trimmedHandle = handle.trim();
    const handleExists = await verifyCodeforcesHandleExists(trimmedHandle);
    if (!handleExists) {
      return res.status(404).json({
        message: "Codeforces handle not found. Check the spelling and try again.",
      });
    }

    // Store the handle in external account table for Codeforces platform
    await upsertExternalAccount(userId, "Codeforces", trimmedHandle);

    const userRole = await checkUserRoleForAuth(userId);

    if (userRole.role === "Mentee") {
      await refreshSkillSnapshotFast(userId);
    }

    const { levelOptions, assessmentMethods, requiresLevelChoice } =
      await prepareLevelChoiceAfterCfConnect(userId);

    if (userRole.role === "Mentee") {
      await activateRoadmapForUserSkillProfile(userId);
    }

    const currentLevel = await getMenteeCodePathLevel(userId);

    return res.status(200).json({
      message:
        "Codeforces account connected. Choose how CodePath should calculate your level.",
      handle: trimmedHandle,
      codePathLevel: currentLevel.tier,
      requiresLevelChoice,
      levelOptions,
      assessmentMethods,
    });
  } catch (error) {
    console.error("Error in cfIntegrationOnRegisteration:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getCodeforcesIntegration = async (
  req: Request,
  res: Response,
) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not authenticated" });
    }

    const account = await getExternalAccountIntegrationFromDB(userId);

    if (!account || !account.handle) {
      return res.status(200).json({
        linked: false,
        handle: null,
        isVerified: false,
        lastSynced: null,
        codePathLevel: null,
      });
    }

    const codePathLevel = await getMenteeCodePathLevel(userId);

    return res.status(200).json({
      linked: true,
      handle: account.handle,
      platform: account.platform,
      isVerified: account.isVerified,
      lastSynced: account.lastSynced,
      codePathLevel: codePathLevel.tier,
    });
  } catch (error) {
    console.error("Error in getCodeforcesIntegration:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const disconnectCodeforces = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not authenticated" });
    }

    const removed = await deleteExternalAccountForUser(userId, "Codeforces");
    if (!removed) {
      return res.status(404).json({
        message: "No connected Codeforces account found",
      });
    }

    const { levelOptions, assessmentMethods, requiresLevelChoice } =
      await prepareLevelChoiceAfterDisconnect(userId);

    const skillProfile = await getMenteeCodePathLevel(userId);

    return res.status(200).json({
      message: "Codeforces account disconnected successfully",
      codePathLevel: skillProfile.tier,
      levelOptions,
      assessmentMethods,
      requiresLevelChoice,
    });
  } catch (error) {
    console.error("Error in disconnectCodeforces:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
