import express from "express";
import {
  createQuizQuestion,
  deleteQuizQuestion,
  getQuizQuestion,
  getQuizQuestions,
  updateQuizQuestion,
} from "../controllers/quiz.controller";
import { authorize } from "../middlewares/authorization";

export const router = express.Router();

//Quiz Questions Management Routes - Dashboard
router.get("/questions", authorize(["Admin"], false), getQuizQuestions);
router.get("/questions/:id", authorize(["Admin"], false), getQuizQuestion);
router.post(
  "/questions/create",
  authorize(["Admin"], false),
  createQuizQuestion
);
router.post(
  "/questions/update/:id",
  authorize(["Admin"], false),
  updateQuizQuestion
);
router.delete(
  "/questions/delete/:id",
  authorize(["Admin"], false),
  deleteQuizQuestion
);
