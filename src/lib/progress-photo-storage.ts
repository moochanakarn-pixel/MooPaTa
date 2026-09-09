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

// Sniffs the actual file signature rather than trusting the browser-supplied
// File.type (or a hand-crafted multipart request's Content-Type, which a
// client controls entirely) — otherwise arbitrary bytes claiming to be
// "image/png" would be written to disk and later served back with an
// image content-type, based on nothing but that claim.
function sniffImageExt(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

// Filenames are always server-generated (userId + angle + timestamp), so
// there's no user-controlled path segment anywhere in the read or write
// path — the GET route looks up the current user's own stored path from
// the DB, it never trusts a client-supplied filename.
export async function saveProgressPhoto(userId: string, angle: PhotoAngle, file: File): Promise<string> {
  if (!ALLOWED_TYPES[file.type]) throw new Error("invalid_type");
  if (file.size > MAX_BYTES) throw new Error("too_large");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImageExt(buf);
  if (!ext) throw new Error("invalid_type");
  const relPath = `${userId}-${angle}-${Date.now()}.${ext}`;
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
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
