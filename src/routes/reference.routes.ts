import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  createSnippet,
  curateSnippets,
  deleteSnippet,
  exportSnippetsPdf,
  exportSnippetsZip,
  getMySnippets,
  getSnippet,
  getSnippetPdf,
  updateSnippet,
} from "../controllers/reference.controller";

const router = express.Router();

// Static paths before /:id
router.post(
  "/",
  authorize(["Mentee", "Admin"], false),
  createSnippet,
);
router.get("/", authorize(["Mentee", "Admin"], false), getMySnippets);
router.get(
  "/export/pdf",
  authorize(["Mentee", "Admin"], false),
  exportSnippetsPdf,
);
router.get(
  "/export/zip",
  authorize(["Mentee", "Admin"], false),
  exportSnippetsZip,
);
router.post("/curate", authorize(["Mentee", "Admin"], false), curateSnippets);

// Param paths
router.get("/:id", authorize(["Mentee", "Admin"], false), getSnippet);
router.put("/:id", authorize(["Mentee", "Admin"], false), updateSnippet);
router.delete("/:id", authorize(["Mentee", "Admin"], false), deleteSnippet);
router.get("/:id/pdf", authorize(["Mentee", "Admin"], false), getSnippetPdf);

export { router };
