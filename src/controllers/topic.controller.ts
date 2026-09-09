import { Request, Response } from "express";
import Joi from "joi";
import {
  createTopic,
  deleteTopic,
  getAllTopics as getAllTopicsFromDB,
  getTopicById as getTopicByIdFromDB,
  getTopicsByModuleId as getTopicsByModuleIdFromDB,
  TopicInUseError,
  updateTopic,
  findTopicByTitle,
} from "../repositories/topic.repo";

const topicBodySchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
  tags: Joi.string().trim().min(1).max(500).required(),
  rating: Joi.string().trim().min(1).max(20).required(),
});

const topicUpdateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120),
  tags: Joi.string().trim().min(1).max(500),
  rating: Joi.string().trim().min(1).max(20),
}).min(1);

export const getAllTopics = async (_req: Request, res: Response) => {
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

export const createTopicHandler = async (req: Request, res: Response) => {
  try {
    const { value, error } = topicBodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const existing = await findTopicByTitle(value.title);
    if (existing) {
      return res.status(409).json({ message: "A topic with this title already exists" });
    }

    const topic = await createTopic(value);
    return res.status(201).json(topic);
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error", error: err });
  }
};

export const updateTopicHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid topic id" });
    }

    const { value, error } = topicUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const existing = await getTopicByIdFromDB(id);
    if (!existing) {
      return res.status(404).json({ message: "Topic not found" });
    }

    if (value.title && value.title.toLowerCase() !== existing.title.toLowerCase()) {
      const duplicate = await findTopicByTitle(value.title);
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ message: "A topic with this title already exists" });
      }
    }

    const topic = await updateTopic(id, value);
    return res.status(200).json(topic);
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error", error: err });
  }
};

export const deleteTopicHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid topic id" });
    }

    const existing = await getTopicByIdFromDB(id);
    if (!existing) {
      return res.status(404).json({ message: "Topic not found" });
    }

    await deleteTopic(id);
    return res.status(200).json({ message: "Topic deleted successfully" });
  } catch (err) {
    if (err instanceof TopicInUseError) {
      return res.status(409).json({ message: err.message });
    }
    if (err instanceof Error && err.message.includes("reference snippet")) {
      return res.status(409).json({ message: err.message });
    }
    return res.status(500).json({ message: "Internal Server Error", error: err });
  }
};
