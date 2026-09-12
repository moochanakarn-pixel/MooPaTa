import path from "node:path";
import fs from "node:fs/promises";

// Single-slot self-uploaded profile picture — same private-storage
// pattern as src/lib/progress-photo-storage.ts (own upload dir, sniffed
// file signature rather than trusting the client's declared type, never
// served except through the current session's own auth-gated route), just
// one file per user instead of one per angle.
const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "avatars");
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sniffImageExt(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export async function saveAvatar(userId: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES[file.type]) throw new Error("invalid_type");
  if (file.size > MAX_BYTES) throw new Error("too_large");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImageExt(buf);
  if (!ext) throw new Error("invalid_type");
  const relPath = `${userId}-${Date.now()}.${ext}`;
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT, relPath), buf);
  return relPath;
}

export async function deleteAvatarFile(relPath: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_ROOT, relPath));
  } catch {
    // already gone — fine, this is best-effort cleanup
  }
}

export async function readAvatarFile(relPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(UPLOAD_ROOT, relPath));
  } catch {
    return null;
  }
}

export function contentTypeForAvatarPath(relPath: string): string {
  const ext = relPath.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
