import { Request, Response } from "express";
import Joi from "joi";
import { ok } from "../lib/response";
import {
  createInsightInDB,
  deleteInsightFromDB,
  getActiveInsightsFromDB,
  getAllInsightsFromDB,
  getInsightByIdFromDB,
  updateInsightInDB,
} from "../repositories/insight.repo";

const insightBodySchema = Joi.object({
  content: Joi.string().trim().min(1).max(1000).required(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
});

const insightUpdateSchema = Joi.object({
  content: Joi.string().trim().min(1).max(1000).optional(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
});

export const getActiveInsights = async (_req: Request, res: Response) => {
  try {
    const insights = await getActiveInsightsFromDB();
    return res.status(200).json(
      ok(insights.map((item) => ({ id: item.id, content: item.content }))),
    );
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getAllInsights = async (_req: Request, res: Response) => {
  try {
    const insights = await getAllInsightsFromDB();
    return res.status(200).json(ok(insights));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getInsight = async (req: Request, res: Response) => {
  try {
    const { value, error } = Joi.object({ id: Joi.number().integer().required() }).validate(
      req.params,
    );
    if (error) return res.status(400).json({ message: error.message });

    const insight = await getInsightByIdFromDB(value.id);
    if (!insight) return res.status(404).json({ message: "Insight not found" });
    return res.status(200).json(ok(insight));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const createInsight = async (req: Request, res: Response) => {
  try {
    const { value, error } = insightBodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const insight = await createInsightInDB(value);
    return res.status(201).json(ok(insight, "Insight created successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const updateInsight = async (req: Request, res: Response) => {
  try {
    const paramResult = Joi.object({ id: Joi.number().integer().required() }).validate(
      req.params,
    );
    if (paramResult.error) {
      return res.status(400).json({ message: paramResult.error.message });
    }

    const bodyResult = insightUpdateSchema.validate(req.body);
    if (bodyResult.error) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    if (Object.keys(bodyResult.value).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const insight = await updateInsightInDB(paramResult.value.id, bodyResult.value);
    if (!insight) return res.status(404).json({ message: "Insight not found" });
    return res.status(200).json(ok(insight, "Insight updated successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const deleteInsight = async (req: Request, res: Response) => {
  try {
    const { value, error } = Joi.object({ id: Joi.number().integer().required() }).validate(
      req.params,
    );
    if (error) return res.status(400).json({ message: error.message });

    const deleted = await deleteInsightFromDB(value.id);
    if (!deleted) return res.status(404).json({ message: "Insight not found" });
    return res.status(200).json(ok(null, "Insight deleted successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
