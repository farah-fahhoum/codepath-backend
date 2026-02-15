import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  getAdminStatistics,
  getMenteeStatistics,
  getMenteeActivity,
  getMenteeGrowth,
} from "../controllers/statistics.controller";
const router = express.Router();

router.get("/admin", authorize(["Admin"], false), getAdminStatistics);
router.get("/mentee", authorize(["Mentee"], false), getMenteeStatistics);
router.get("/mentee/activity", authorize(["Mentee"], false), getMenteeActivity);
router.get("/mentee/growth", authorize(["Mentee"], false), getMenteeGrowth);

export { router };
