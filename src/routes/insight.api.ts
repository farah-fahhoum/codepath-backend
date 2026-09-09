import express from "express";
import {
  createInsight,
  deleteInsight,
  getActiveInsights,
  getAllInsights,
  getInsight,
  updateInsight,
} from "../controllers/insight.controller";
import { authorize } from "../middlewares/authorization";

const router = express.Router();

router.get("/", authorize(["Mentee"], false), getActiveInsights);
router.get("/manage", authorize(["Admin"], false), getAllInsights);
router.get("/manage/:id", authorize(["Admin"], false), getInsight);
router.post("/manage", authorize(["Admin"], false), createInsight);
router.put("/manage/:id", authorize(["Admin"], false), updateInsight);
router.delete("/manage/:id", authorize(["Admin"], false), deleteInsight);

export { router };
