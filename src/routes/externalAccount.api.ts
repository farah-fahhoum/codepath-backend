import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  cfIntegrationOnRegisteration,
  getCodeforcesIntegration,
} from "../controllers/externalAccount.controller";

const router = express.Router();

router.post(
  "/codeforces/integrate",
  authorize(["Mentee"], false),
  cfIntegrationOnRegisteration,
);

router.get(
  "/codeforces/integration",
  authorize(["Mentee"], false),
  getCodeforcesIntegration,
);

export { router };
