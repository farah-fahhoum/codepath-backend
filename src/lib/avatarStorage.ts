import fs from "fs/promises";
import path from "path";

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
export const AVATARS_DIR = path.join(UPLOADS_ROOT, "avatars");

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function ensureAvatarDir(): Promise<void> {
  await fs.mkdir(AVATARS_DIR, { recursive: true });
}

export function avatarPublicPath(filename: string): string {
  return `/uploads/avatars/${filename}`;
}

export function normalizeAvatarExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
}

export async function deleteAvatarFile(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl?.startsWith("/uploads/avatars/")) return;
  const relativePath = avatarUrl.replace(/^\/uploads\//, "");
  const filePath = path.join(UPLOADS_ROOT, relativePath);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be missing.
  }
}
