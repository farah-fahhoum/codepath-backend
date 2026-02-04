import { Request, Response } from "express";
import {
  getAllSkillLevels as getAllSkillLevelsFromDB,
  getSkillLevelById as getSkillLevelByIdFromDB,
} from "../repositories/skillLevel.repo";

export const getAllSkillLevels = async (req: Request, res: Response) => {
  try {
    const skillLevels = await getAllSkillLevelsFromDB();
    return res.status(200).json(skillLevels);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getSkillLevelById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const skillLevel = await getSkillLevelByIdFromDB(Number(id));

    if (!skillLevel) {
      return res.status(404).json({ message: "Skill level not found" });
    }

    return res.status(200).json(skillLevel);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
