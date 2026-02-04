import express from "express";
import {
  getAllTopics,
  getTopicById,
  getTopicsByModuleId,
} from "../controllers/topic.controller";
import { authorize } from "../middlewares/authorization";

const router = express.Router();

router.get("/", authorize(["Admin", "Mentee"], false), getAllTopics);
router.get("/:id", authorize(["Admin", "Mentee"], false), getTopicById);
router.get(
  "/module/:moduleId",
  authorize(["Admin", "Mentee"], false),
  getTopicsByModuleId,
);

export { router };
