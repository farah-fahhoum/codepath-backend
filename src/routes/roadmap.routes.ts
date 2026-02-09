import express from "express";
import {
  getRoadmaps,
  getRoadmap,
  deleteRoadmap,
  createModule,
  updateModule,
  deleteModule,
  createResource,
  updateResource,
  deleteResource,
  createProblem,
  updateProblem,
  deleteProblem,
  createRoadmap,
  updateRoadmap,
  getMenteeTopicPerformanceOverview,
} from "../controllers/roadmap.controller";
import { authorize } from "../middlewares/authorization";

const router = express.Router();

// Roadmap routes
router.get("/", authorize(["Admin"], false), getRoadmaps);
router.get("/:id", authorize(["Admin", "Mentee"], false), getRoadmap); //Admin & Mentee View
router.post("/create", authorize(["Admin"], false), createRoadmap);
router.put("/update/:id", authorize(["Admin"], false), updateRoadmap);
router.delete("/delete/:id", authorize(["Admin"], false), deleteRoadmap);

// Module routes
router.post("/create/modules", authorize(["Admin"], false), createModule);
router.put("/update/modules/:id", authorize(["Admin"], false), updateModule);
router.delete("/delete/modules/:id", authorize(["Admin"], false), deleteModule);
//Topics routes - AIx
router.get(
  "/modules/topic/mentee-performance-overview",
  authorize(["Mentee"], false),
  getMenteeTopicPerformanceOverview,
);

// Resource routes
router.post("/create/resources", authorize(["Admin"], false), createResource);
router.put(
  "/update/resources/:id",
  authorize(["Admin"], false),
  updateResource,
);
router.delete(
  "/delete/resources/:id",
  authorize(["Admin"], false),
  deleteResource,
);

// Problem routes
router.post("/create/problems", authorize(["Admin"], false), createProblem);
router.put("/update/problems/:id", authorize(["Admin"], false), updateProblem);
router.delete(
  "/delete/problems/:id",
  authorize(["Admin"], false),
  deleteProblem,
);

export { router };
