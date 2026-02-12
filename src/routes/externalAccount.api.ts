import express from "express";
import { authorize } from "../middlewares/authorization";
import { cfIntegrationOnRegisteration } from "../controllers/externalAccount.controller";

const router = express.Router();

router.post(
  "/codeforces/integrate",
  authorize(["Mentee"], false),
  cfIntegrationOnRegisteration,
);
export { router };
