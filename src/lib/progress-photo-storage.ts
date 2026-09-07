import path from "node:path";
import fs from "node:fs/promises";
import type { PhotoAngle } from "./progress-photo-types";

export { PHOTO_ANGLES, PHOTO_ANGLE_LABEL, angleField, type PhotoAngle } from "./progress-photo-types";

// Stored outside public/ — the only way to ever read one of these files
// back is through the auth-gated GET route below, never a static URL.
const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "progress-photos");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Filenames are always server-generated (userId + angle + timestamp), so
// there's no user-controlled path segment anywhere in the read or write
// path — the GET route looks up the current user's own stored path from
// the DB, it never trusts a client-supplied filename.
export async function saveProgressPhoto(userId: string, angle: PhotoAngle, file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("invalid_type");
  if (file.size > MAX_BYTES) throw new Error("too_large");
  const relPath = `${userId}-${angle}-${Date.now()}.${ext}`;
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_ROOT, relPath), buf);
  return relPath;
}

export async function deleteProgressPhotoFile(relPath: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_ROOT, relPath));
  } catch {
    // already gone — fine, this is best-effort cleanup
  }
}

export async function readProgressPhotoFile(relPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(UPLOAD_ROOT, relPath));
  } catch {
    return null;
  }
}

export function contentTypeForPath(relPath: string): string {
  const ext = relPath.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
