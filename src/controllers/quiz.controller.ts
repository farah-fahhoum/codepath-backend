import { Request, Response } from "express";
import Joi from "joi";
import axios from "axios";
import { ok } from "../lib/response";
import { prisma } from "../lib/prisma";
import {
  addQuizQuestionToDB,
  deleteQuizQuestionFromDB,
  getQuizQuestionByIdFromDB,
  getQuizQuestionsFromDB,
  updateQuizQuestionInDB,
  getRandomQuizQuestionsFromDBForMentee,
  getAllQuizQuestionsForMentee,
} from "../repositories/quiz.repo";
import {
  getSkillLevelByTitle,
  getAllSkillLevels,
} from "../repositories/skillLevel.repo";
import { activateUserRoadmapForSkillLevelInDB } from "../repositories/roadmap.repo";

export const getQuizQuestions = async (_req: Request, res: Response) => {
  try {
    const questions = await getQuizQuestionsFromDB();
    return res.status(200).json(ok(questions));
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
    return res.status(200).json(ok(question));
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
      numberofQuestions: Joi.alternatives()
        .try(Joi.number().integer().min(1), Joi.string().pattern(/^\d+$/))
        .required(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const count =
      typeof value.numberofQuestions === "string"
        ? parseInt(value.numberofQuestions, 10)
        : value.numberofQuestions;

    const questions = await getRandomQuizQuestionsFromDBForMentee(count);
    return res.status(200).json(questions);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

/** Get all quiz questions from DB (for placement quiz — whole table) */
export const getQuizAll = async (_req: Request, res: Response) => {
  try {
    const questions = await getAllQuizQuestionsForMentee();
    return res.status(200).json(questions);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getQuizAIVersion = async (req: Request, res: Response) => {
  try {
    const querySchema = Joi.object({
      numberofQuestions: Joi.alternatives()
        .try(Joi.number().integer().min(1), Joi.string().pattern(/^\d+$/))
        .required(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const count =
      typeof value.numberofQuestions === "string"
        ? parseInt(value.numberofQuestions, 10)
        : value.numberofQuestions;

    // Make API call to FastAPI quiz service
    const fastApiUrl =
      process.env.FASTAPI_BASE_URL +
      "/quiz/start?limit=" +
      count;

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

      const result = response.data.data ?? response.data;
      const { level, accuracy } = result;

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
        MenteeLevel: result.level,
        ResultAccuracy: result.accuracy,
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

/** Submit DB quiz (text answers) — score by comparing to correct answer, determine level from total score */
export const submitQuizDB = async (req: Request, res: Response) => {
  try {
    const bodySchema = Joi.object({
      answers: Joi.array()
        .items(
          Joi.object({
            questionId: Joi.number().integer().required(),
            userAnswer: Joi.string().allow("").required(),
          })
        )
        .required(),
    });
    const { value, error } = bodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // @ts-expect-error userId is set by auth middleware
    const userId = req.user?.id as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    let totalScore = 0;
    let maxScore = 0;

    for (const a of value.answers) {
      const question = await getQuizQuestionByIdFromDB(a.questionId);
      if (!question) continue;
      maxScore += question.score;
      const correct =
        String(a.userAnswer).trim().toLowerCase() ===
        String(question.answer).trim().toLowerCase();
      if (correct) totalScore += question.score;
    }

    const levels = await getAllSkillLevels();
    if (levels.length === 0) {
      return res.status(500).json({
        message: "No skill levels configured",
      });
    }

    const percentage = maxScore > 0 ? totalScore / maxScore : 0;
    const levelIndex = Math.min(
      Math.floor(percentage * levels.length),
      levels.length - 1
    );
    const skillLevel = levels[levelIndex];
    const skillLevelId = skillLevel.id;

    await prisma.userSkillAssessment.upsert({
      where: {
        userId_assessmentType_skillLevelId: {
          userId,
          assessmentType: "Quiz",
          skillLevelId,
        },
      },
      create: {
        userId,
        assessmentType: "Quiz",
        score: totalScore,
        skillLevelId,
      },
      update: { score: totalScore, updatedAt: new Date() },
    });

    await activateUserRoadmapForSkillLevelInDB(userId, skillLevelId);

    return res.status(200).json({
      level: skillLevel.title,
      totalScore,
      maxScore,
    });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error", error: err });
  }
};
