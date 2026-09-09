import express from "express";
import {
  getAllTopics,
  getTopicById,
  getTopicsByModuleId,
  createTopicHandler,
  updateTopicHandler,
  deleteTopicHandler,
} from "../controllers/topic.controller";
import { authorize } from "../middlewares/authorization";

const router = express.Router();

router.get("/", authorize(["Admin", "Mentee"], false), getAllTopics);
router.post("/", authorize(["Admin"], false), createTopicHandler);
router.get(
  "/module/:moduleId",
  authorize(["Admin", "Mentee"], false),
  getTopicsByModuleId,
);
router.get("/:id", authorize(["Admin", "Mentee"], false), getTopicById);
router.put("/:id", authorize(["Admin"], false), updateTopicHandler);
router.delete("/:id", authorize(["Admin"], false), deleteTopicHandler);

export { router };
