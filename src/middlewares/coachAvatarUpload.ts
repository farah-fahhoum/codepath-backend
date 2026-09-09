import multer from "multer";
import path from "path";
import {
  AVATARS_DIR,
  ensureAvatarDir,
  normalizeAvatarExtension,
} from "../lib/avatarStorage";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureAvatarDir()
      .then(() => cb(null, AVATARS_DIR))
      .catch((error) => cb(error as Error, AVATARS_DIR));
  },
  filename: (req, file, cb) => {
    const coachId = typeof req.params.id === "string" ? req.params.id : "coach";
    const ext = normalizeAvatarExtension(file.originalname);
    cb(null, `coach-${coachId}-${Date.now()}${ext}`);
  },
});

export const coachAvatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed"));
  },
});

export const coachAvatarUploadMiddleware = coachAvatarUpload.single("avatar");
