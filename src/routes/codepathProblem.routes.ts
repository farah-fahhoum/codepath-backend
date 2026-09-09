import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  createCodePathProblem,
  createProblemTestCase,
  deleteCodePathProblem,
  deleteProblemTestCase,
  getCodePathProblemById,
  getCodePathSubmissionById,
  getMyCodePathSubmissions,
  listAllCodePathProblemsAdmin,
  listCodePathProblems,
  publishCodePathProblem,
  submitCodePathProblem,
  unpublishCodePathProblem,
  updateCodePathProblem,
  updateProblemTestCase,
} from "../controllers/codepathProblem.controller";

const router = express.Router();

// Static paths before /:id
router.get(
  "/admin/all",
  authorize(["Admin"], false),
  listAllCodePathProblemsAdmin,
);

router.get(
  "/submissions/:submissionId",
  authorize(["Mentee", "Admin"], false),
  getCodePathSubmissionById,
);

router.get(
  "/",
  authorize(["Mentee", "Admin"], false),
  listCodePathProblems,
);

router.post("/", authorize(["Admin"], false), createCodePathProblem);

// Problem by id
router.get(
  "/:id",
  authorize(["Mentee", "Admin"], false),
  getCodePathProblemById,
);

router.put("/:id", authorize(["Admin"], false), updateCodePathProblem);

router.delete("/:id", authorize(["Admin"], false), deleteCodePathProblem);

router.post("/:id/publish", authorize(["Admin"], false), publishCodePathProblem);

router.post(
  "/:id/unpublish",
  authorize(["Admin"], false),
  unpublishCodePathProblem,
);

router.post(
  "/:id/test-cases",
  authorize(["Admin"], false),
  createProblemTestCase,
);

router.put(
  "/:id/test-cases/:caseId",
  authorize(["Admin"], false),
  updateProblemTestCase,
);

router.delete(
  "/:id/test-cases/:caseId",
  authorize(["Admin"], false),
  deleteProblemTestCase,
);

router.post(
  "/:id/submit",
  authorize(["Mentee", "Admin"], false),
  submitCodePathProblem,
);

router.get(
  "/:id/submissions/me",
  authorize(["Mentee", "Admin"], false),
  getMyCodePathSubmissions,
);

export { router };
