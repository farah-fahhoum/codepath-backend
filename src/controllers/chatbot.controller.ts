import { Request, Response } from "express";
import Joi from "joi";
import axios from "axios";

export const askChatbot = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      question: Joi.string().required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { question } = value;

    // Make API call to FastAPI service
    const fastApiUrl = process.env.FASTAPI_BASE_URL + "/api/chat";

    try {
      const response = await axios.post(
        fastApiUrl,
        {
          question: question,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 second timeout
        }
      );

      // Return the response from FastAPI
      return res.status(200).json(response.data);
    } catch (axiosError) {
      if (axios.isAxiosError(axiosError)) {
        if (axiosError.code === "ECONNREFUSED") {
          return res.status(503).json({
            message: "Chatbot service is currently unavailable",
            error: "Service connection refused",
          });
        } else if (axiosError.response) {
          // Forward the error response from FastAPI
          return res
            .status(axiosError.response.status)
            .json(axiosError.response.data);
        } else if (axiosError.request) {
          return res.status(504).json({
            message: "Chatbot service request timeout",
            error: "No response received from service",
          });
        }
      }

      // Generic error fallback
      return res.status(500).json({
        message: "Error communicating with chatbot service",
        error: axiosError.message,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};
