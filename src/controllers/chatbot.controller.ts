import { Request, Response } from "express";
import Joi from "joi";
import { FastAPIError, postFastAPI } from "../lib/fastapiClient";

interface ChatResponse {
  reply: string;
}

export const askChatbot = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      question: Joi.string().required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { question } = value;

    try {
      const response = await postFastAPI<ChatResponse>("/api/chat", {
        question,
      });
      return res.status(200).json(response);
    } catch (serviceError) {
      if (serviceError instanceof FastAPIError) {
        return res.status(serviceError.status).json({
          message: serviceError.message,
          error: serviceError.message,
        });
      }
      return res.status(500).json({
        message: "Error communicating with chatbot service",
        error: (serviceError as Error).message,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};
