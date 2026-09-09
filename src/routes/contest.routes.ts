import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  cancelContest,
  completeContest,
  createContest,
  deleteContest,
  finishContest,
  getContest,
  getContests,
  getMyContests,
  getMySubmissions,
  getScoreboard,
  joinContest,
  publishContest,
  startContest,
  startVirtualContest,
  submitSolution,
  updateContest,
} from "../controllers/contest.controller";

const router = express.Router();

// Static paths before /:id
router.get("/", authorize(["Mentee", "Admin"], false), getContests);
router.get("/my", authorize(["Mentee", "Admin"], false), getMyContests);
router.post("/create", authorize(["Admin"], false), createContest);

// Param paths
router.get("/:id", authorize(["Mentee", "Admin"], false), getContest);
router.put("/:id", authorize(["Admin"], false), updateContest);
router.post("/:id/publish", authorize(["Admin"], false), publishContest);
router.post("/:id/join", authorize(["Mentee", "Admin"], false), joinContest);
router.post("/:id/start", authorize(["Mentee", "Admin"], false), startContest);
router.post("/:id/virtual/start", authorize(["Mentee", "Admin"], false), startVirtualContest);
router.post(
  "/:id/submissions",
  authorize(["Mentee", "Admin"], false),
  submitSolution,
);
router.post(
  "/:id/finish",
  authorize(["Mentee", "Admin"], false),
  finishContest,
);
router.get(
  "/:id/scoreboard",
  authorize(["Mentee", "Admin"], false),
  getScoreboard,
);
router.get(
  "/:id/my-submissions",
  authorize(["Mentee", "Admin"], false),
  getMySubmissions,
);
router.post(
  "/:id/complete",
  authorize(["Admin"], false),
  completeContest,
);
router.post("/:id/cancel", authorize(["Admin"], false), cancelContest);
router.delete("/:id", authorize(["Admin"], false), deleteContest);

export { router };
