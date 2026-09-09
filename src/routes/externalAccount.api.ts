import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  cfIntegrationOnRegisteration,
  getCodeforcesIntegration,
  disconnectCodeforces,
} from "../controllers/externalAccount.controller";

const router = express.Router();

router.post(
  "/codeforces/integrate",
  authorize(["Mentee", "Admin"], false),
  cfIntegrationOnRegisteration,
);

router.get(
  "/codeforces/integration",
  authorize(["Mentee", "Admin"], false),
  getCodeforcesIntegration,
);

router.delete(
  "/codeforces/disconnect",
  authorize(["Mentee", "Admin"], false),
  disconnectCodeforces,
);

export { router };
