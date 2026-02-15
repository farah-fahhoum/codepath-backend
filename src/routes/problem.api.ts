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
router.get("/:contestId/:index", getProblem);

// Run code (Piston)
router.post("/run", runCode);

//Favourite Problem Routes
router.get("/favourites", authorize(["Mentee"], false), getFavouriteProblems);
router.post(
  "/favourites/add",
  authorize(["Mentee"], false),
  addProblemToFavourite,
);
router.delete(
  "/favourites/remove/:id",
  authorize(["Mentee"], false),
  removeProblemFromFavourite,
);

//Problems Submission Routes
router.post("/submit", authorize(["Mentee"], false), submitProblem);
router.post(
  "/sync-submission",
  authorize(["Mentee", "Admin"], false),
  syncSubmissionFromCodeforces,
);

export { router };
