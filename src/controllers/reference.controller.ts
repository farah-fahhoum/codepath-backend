import { Request, Response } from "express";
import Joi from "joi";
import archiver from "archiver";
import { ok } from "../lib/response";
import {
  createSnippetInDB,
  deleteSnippetFromDB,
  getMySnippetsFromDB,
  getSnippetByIdFromDB,
  getSnippetForUserFromDB,
  updateSnippetInDB,
} from "../repositories/reference.repo";
import {
  getUserQuizPerformanceFromDB,
  getUserCodeforcesStatsFromDB,
} from "../repositories/roadmapAI.repo";
import { generateSnippetsPdf, highlightLanguage } from "../lib/pdf";
import { FastAPIError, curateReference } from "../lib/fastapiClient";

const snippetSchema = Joi.object({
  title: Joi.string().min(1).required(),
  language: Joi.string().min(1).required(),
  code: Joi.string().min(1).required(),
  topicId: Joi.number().integer().positive().optional().allow(null),
  notes: Joi.string().optional().allow(""),
  tags: Joi.string().optional().allow(""),
  isPublic: Joi.boolean().optional(),
});

export const createSnippet = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const { value, error } = snippetSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const snippet = await createSnippetInDB({
      userId,
      topicId: value.topicId,
      title: value.title,
      language: value.language,
      code: value.code,
      notes: value.notes,
      tags: value.tags,
      isPublic: value.isPublic,
    });

    return res.status(201).json(ok({ snippet }, "Snippet saved"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMySnippets = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const querySchema = Joi.object({
      topicId: Joi.number().integer().positive().optional(),
      search: Joi.string().optional(),
    });
    const { value, error } = querySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const snippets = await getMySnippetsFromDB(userId, {
      topicId: value.topicId,
      search: value.search,
    });
    return res.status(200).json(ok(snippets));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getSnippet = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const snippet = await getSnippetByIdFromDB(value.id);
    if (!snippet) return res.status(404).json({ message: "Snippet not found" });
    if (!snippet.isPublic && snippet.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to view this snippet" });
    }

    return res.status(200).json(ok(snippet));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const updateSnippet = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value: params, error: paramError } = paramSchema.validate(req.params);
    if (paramError) return res.status(400).json({ message: paramError.message });

    const bodySchema = Joi.object({
      title: Joi.string().min(1).optional(),
      language: Joi.string().min(1).optional(),
      code: Joi.string().min(1).optional(),
      topicId: Joi.number().integer().positive().optional().allow(null),
      notes: Joi.string().optional().allow(""),
      tags: Joi.string().optional().allow(""),
      isPublic: Joi.boolean().optional(),
    }).min(1);
    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const existing = await getSnippetForUserFromDB(params.id, userId);
    if (!existing) {
      return res.status(404).json({ message: "Snippet not found or not yours" });
    }

    const snippet = await updateSnippetInDB(params.id, body);
    return res.status(200).json(ok({ snippet }, "Snippet updated"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const deleteSnippet = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const existing = await getSnippetForUserFromDB(value.id, userId);
    if (!existing) {
      return res.status(404).json({ message: "Snippet not found or not yours" });
    }

    await deleteSnippetFromDB(value.id);
    return res.status(200).json(ok(null, "Snippet deleted"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getSnippetPdf = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const snippet = await getSnippetForUserFromDB(value.id, userId);
    if (!snippet) {
      return res.status(404).json({ message: "Snippet not found or not yours" });
    }

    const pdf = await generateSnippetsPdf([snippet], { title: snippet.title });
    const filename = `reference-${snippet.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdf);
  } catch (error: any) {
    if (error?.message?.includes("browser")) {
      return res.status(503).json({
        message: "PDF generation is unavailable (browser not installed)",
      });
    }
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const exportSnippetsPdf = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const snippets = await getMySnippetsFromDB(userId);
    if (snippets.length === 0) {
      return res.status(404).json({ message: "No snippets to export" });
    }

    const pdf = await generateSnippetsPdf(snippets, { title: "My Reference Sheet" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="reference-sheet.pdf"');
    return res.send(pdf);
  } catch (error: any) {
    if (error?.message?.includes("browser")) {
      return res.status(503).json({
        message: "PDF generation is unavailable (browser not installed)",
      });
    }
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const exportSnippetsZip = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const snippets = await getMySnippetsFromDB(userId);
    if (snippets.length === 0) {
      return res.status(404).json({ message: "No snippets to export" });
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      res.status(500).json({ message: "Archive error", error: err.message });
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="reference-sheet.zip"');
    archive.pipe(res);

    for (const snippet of snippets) {
      const pdf = await generateSnippetsPdf([snippet], { title: snippet.title });
      const safeTitle = (snippet.title || snippet.id)
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
      archive.append(pdf, { name: `pdfs/${safeTitle}.pdf` });
    }

    archive.append(
      Buffer.from(
        JSON.stringify(
          snippets.map((s) => ({
            id: s.id,
            title: s.title,
            language: s.language,
            topic: s.topic?.title ?? null,
            tags: s.tags,
            isPublic: s.isPublic,
          })),
          null,
          2,
        ),
        "utf-8",
      ),
      { name: "metadata.json" },
    );

    await archive.finalize();
  } catch (error: any) {
    if (error?.message?.includes("browser")) {
      return res.status(503).json({
        message: "PDF generation is unavailable (browser not installed)",
      });
    }
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const curateSnippets = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const snippets = await getMySnippetsFromDB(userId);
    if (snippets.length === 0) {
      return res.status(400).json({ message: "Save at least one snippet to curate" });
    }

    const [quizPerformance, codeforcesStats] = await Promise.all([
      getUserQuizPerformanceFromDB(userId),
      getUserCodeforcesStatsFromDB(userId),
    ]);

    let response;
    try {
      response = await curateReference({
        userId,
        snippets: snippets.map((s) => ({
          id: s.id,
          title: s.title,
          topicId: s.topicId,
          topicTitle: s.topic?.title ?? null,
          language: highlightLanguage(s.language),
          notesPreview: s.notes ? s.notes.slice(0, 200) : null,
        })),
        quizPerformance,
        codeforcesStats,
      });
    } catch (serviceError) {
      if (serviceError instanceof FastAPIError) {
        return res.status(serviceError.status).json({
          message: serviceError.message,
        });
      }
      throw serviceError;
    }

    return res.status(200).json(ok({
      sections: response.sections,
      snippetCount: snippets.length,
    }));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
