import express from "express";
import {
  getAllSkillLevels,
  getSkillLevelById,
} from "../controllers/skillLevel.controller";
import { authorize } from "../middlewares/authorization";

const router = express.Router();

router.get("/", authorize(["Admin", "Mentee"], false), getAllSkillLevels);
router.get("/:id", authorize(["Admin", "Mentee"], false), getSkillLevelById);

export { router };
