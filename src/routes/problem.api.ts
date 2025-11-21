import express from "express";
import {
  addProblemToFavourite,
  getFavouriteProblems,
  getProblem,
  getProblems,
  removeProblemFromFavourite,
} from "../controllers/problem.controller";
import { authorize } from "../middlewares/authorization";
const router = express.Router();

//Problemset Routes
router.get("/", getProblems);
router.get("/:contestId/:index", getProblem);

//Favourite Problem Routes
router.get("/favourites", authorize(["Mentee"], false), getFavouriteProblems);
router.post(
  "/favourites/add",
  authorize(["Mentee"], false),
  addProblemToFavourite
);
router.delete(
  "/favourites/remove/:id",
  authorize(["Mentee"], false),
  removeProblemFromFavourite
);
export { router };
