import express from "express";
import {
  addProblemToFavourite,
  getFavouriteProblems,
  getProblem,
  getProblems,
  removeProblemFromFavourite,
  runCode,
  submitProblem,
  syncSubmissionFromCodeforces,
} from "../controllers/problem.controller";
import { authorize } from "../middlewares/authorization";
const router = express.Router();

//Problemset Routes
router.get("/", getProblems);

//Favourite Problem Routes (before /:contestId/:index to avoid route conflicts)
router.get("/favourites", authorize(["Mentee", "Admin"], false), getFavouriteProblems);
router.post(
  "/favourites/add",
  authorize(["Mentee", "Admin"], false),
  addProblemToFavourite,
);
router.delete(
  "/favourites/remove/:id",
  authorize(["Mentee", "Admin"], false),
  removeProblemFromFavourite,
);

router.get("/:contestId/:index", getProblem);

// Run code (Piston)
router.post("/run", runCode);

//Problems Submission Routes
router.post("/submit", authorize(["Mentee"], false), submitProblem);
router.post(
  "/sync-submission",
  authorize(["Mentee", "Admin"], false),
  syncSubmissionFromCodeforces,
);

export { router };
