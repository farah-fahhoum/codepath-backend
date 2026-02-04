import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  getAdminStatistics,
  getMenteeStatistics,
} from "../controllers/statistics.controller";
const router = express.Router();

router.get("/admin", authorize(["Admin"], false), getAdminStatistics);
router.get("/mentee", authorize(["Mentee"], false), getMenteeStatistics);

export { router };
