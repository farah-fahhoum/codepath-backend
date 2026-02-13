import { Request, Response } from "express";
import Joi from "joi";
import axios from "axios";
import { prisma } from "../lib/prisma";
import {
  addQuizQuestionToDB,
  deleteQuizQuestionFromDB,
  getQuizQuestionByIdFromDB,
  getQuizQuestionsFromDB,
  updateQuizQuestionInDB,
  getRandomQuizQuestionsFromDBForMentee,
} from "../repositories/quiz.repo";
import { getSkillLevelByTitle } from "../repositories/skillLevel.repo";
import { activateUserRoadmapForSkillLevelInDB } from "../repositories/roadmap.repo";

export const getQuizQuestions = async (_req: Request, res: Response) => {
  try {
    const questions = await getQuizQuestionsFromDB();
    return res.status(200).json(questions);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getQuizQuestion = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.number().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const question = await getQuizQuestionByIdFromDB(value.id);
    if (!question)
      return res.status(404).json({ message: "Invalid question id" });
    return res.status(200).json(question);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const createQuizQuestion = async (req: Request, res: Response) => {
  try {
    const inputSchema = Joi.object({
      questionTitle: Joi.string().required(),
      answer: Joi.string().required(),
      score: Joi.number().min(1).max(100).required(),
    });
    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { questionTitle, answer, score } = value;
    await addQuizQuestionToDB(questionTitle, answer, score);
    return res.status(201).json({ message: "Question added successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const updateQuizQuestion = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.number().required() });
    const bodySchema = Joi.object({
      questionTitle: Joi.string().optional(),
      answer: Joi.string().optional(),
      score: Joi.number().min(1).max(100).optional(),
    });

    const { value: params, error: paramError } = paramSchema.validate(
      req.params,
    );
    if (paramError)
      return res.status(400).json({ message: paramError.message });

    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const { questionTitle, answer, score } = body;
    await updateQuizQuestionInDB(params.id, { questionTitle, answer, score });
    return res.status(200).json({ message: "Question updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const deleteQuizQuestion = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.number().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const adminAffected = await deleteQuizQuestionFromDB(value.id);
    //Check number of affected rows in DB after deletion
    if (adminAffected > 0)
      return res.status(200).json({ message: "Question deleted successfully" });
    else return res.status(404).json({ message: "Invalid question id" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

//Get random questions to form a quiz for the mentee - Questions number is provided by admin
export const getQuiz = async (req: Request, res: Response) => {
  try {
    const querySchema = Joi.object({
      numberofQuestions: Joi.number().integer().min(1).required(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const questions = await getRandomQuizQuestionsFromDBForMentee(
      value.numberofQuestions,
    );
    return res.status(200).json(questions);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getQuizAIVersion = async (req: Request, res: Response) => {
  try {
    const querySchema = Joi.object({
      numberofQuestions: Joi.number().integer().min(1).required(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    // Make API call to FastAPI quiz service
    const fastApiUrl =
      process.env.FASTAPI_BASE_URL +
      "/quiz/start?limit=" +
      value.numberofQuestions;

    try {
      const response = await axios.get(fastApiUrl, {
        headers: {
          accept: "application/json",
        },
        timeout: 10000, // 10 second timeout
      });

      // Return the response from FastAPI
      return res.status(200).json(response.data);
    } catch (axiosError) {
      if (axios.isAxiosError(axiosError)) {
        if (axiosError.code === "ECONNREFUSED") {
          return res.status(503).json({
            message: "Quiz AI service is currently unavailable",
            error: "Service connection refused",
          });
        } else if (axiosError.response) {
          // Forward the error response from FastAPI
          return res
            .status(axiosError.response.status)
            .json(axiosError.response.data);
        } else if (axiosError.request) {
          return res.status(504).json({
            message: "Quiz AI service request timeout",
            error: "No response received from service",
          });
        }
      }

      return res.status(500).json({
        message: "Error communicating with quiz AI service",
        error: axiosError.message,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const submitQuiz = async (req: Request, res: Response) => {
  try {
    const bodySchema = Joi.object({
      answers: Joi.array()
        .items(
          Joi.object({
            question_id: Joi.number().required(),
            selected_option: Joi.number().required(),
          }),
        )
        .required(),
    });

    const { value, error } = bodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { quizId, answers } = value;

    // Make API call to FastAPI quiz service
    const fastApiUrl = process.env.FASTAPI_BASE_URL + "/quiz/submit";

    try {
      const response = await axios.post(fastApiUrl, {
        quizId,
        answers,
      });

      const { level, accuracy } = response.data;

      // Get skill level ID from database based on level title
      const skillLevel = await getSkillLevelByTitle(level);
      const skillLevelId = skillLevel?.id || 1;

      // @ts-expect-error userId is defined
      const userId = req.user?.id as string;

      await prisma.userSkillAssessment.create({
        data: {
          userId: userId,
          assessmentType: "Quiz",
          score: Math.round(accuracy * 100), // Convert accuracy to percentage
          skillLevelId: skillLevelId,
        },
      });

      await activateUserRoadmapForSkillLevelInDB(userId, skillLevelId);

      // Return the response from FastAPI
      return res.status(200).json({
        MenteeLevel: response.data.level,
        ResultAccuracy: response.data.accuracy,
      });
    } catch (axiosError) {
      if (axios.isAxiosError(axiosError)) {
        if (axiosError.code === "ECONNREFUSED") {
          return res.status(503).json({
            message: "Quiz AI service is currently unavailable",
            error: "Service connection refused",
          });
        } else if (axiosError.response) {
          // Forward the error response from FastAPI
          return res
            .status(axiosError.response.status)
            .json(axiosError.response.data);
        } else if (axiosError.request) {
          return res.status(504).json({
            message: "Quiz AI service request timeout",
            error: "No response received from service",
          });
        }
      }

      return res.status(500).json({
        message: "Error communicating with quiz AI service",
        error: axiosError.message,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
