import { Request, Response } from "express";
import {
  getAllTopics as getAllTopicsFromDB,
  getTopicById as getTopicByIdFromDB,
  getTopicsByModuleId as getTopicsByModuleIdFromDB,
} from "../repositories/topic.repo";

export const getAllTopics = async (req: Request, res: Response) => {
  try {
    const topics = await getAllTopicsFromDB();
    return res.status(200).json(topics);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getTopicById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const topic = await getTopicByIdFromDB(Number(id));

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    return res.status(200).json(topic);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getTopicsByModuleId = async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const topics = await getTopicsByModuleIdFromDB(Number(moduleId));
    return res.status(200).json(topics);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
