import { Request, Response } from "express";
import { createExternalAccount } from "../repositories/externalAccount.repo";
import { getMenteeCodePathLevel } from "../repositories/statistics.repo";
import { getSkillLevelByTitle } from "../repositories/skillLevel.repo";
import { activateUserRoadmapForSkillLevelInDB } from "../repositories/roadmap.repo";

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

    if (!handle) {
      return res
        .status(400)
        .json({ message: "Bad Request: Handle is required" });
    }

    // Store the handle in external account table for Codeforces platform
    await createExternalAccount(userId, "codeforces", handle);

    // Call getMenteeCodePathLevel to get the user's level
    const codePathLevel = await getMenteeCodePathLevel(userId);

    if (codePathLevel.tier && codePathLevel.tier !== "Not Assessed") {
      const skillLevel = await getSkillLevelByTitle(codePathLevel.tier);
      if (skillLevel) {
        await activateUserRoadmapForSkillLevelInDB(userId, skillLevel.id);
      }
    }

    return res.status(200).json({
      message: "Codeforces integration successful",
      handle,
      codePathLevel: codePathLevel.tier,
    });
  } catch (error) {
    console.error("Error in cfIntegrationOnRegisteration:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
