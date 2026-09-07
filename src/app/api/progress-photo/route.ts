import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { PHOTO_ANGLES, angleField, deleteProgressPhotoFile, saveProgressPhoto, type PhotoAngle } from "@/lib/progress-photo-storage";

// Uploads (replacing, if one already exists) the current photo for one
// angle — front/side/back is a single current slot each, not a history,
// matching how the reference app's "upload front/side/back" UI works.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const angle = form?.get("angle");
  const file = form?.get("photo");
  if (typeof angle !== "string" || !PHOTO_ANGLES.includes(angle as PhotoAngle)) {
    return NextResponse.json({ error: "invalid_angle" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const field = angleField(angle as PhotoAngle);
  let relPath: string;
  try {
    relPath = await saveProgressPhoto(userId, angle as PhotoAngle, file);
  } catch (err) {
    const code = err instanceof Error ? err.message : "upload_failed";
    const status = code === "too_large" ? 413 : 400;
    return NextResponse.json({ error: code }, { status });
  }

  const previousPath = user[field];
  await db.user.update({ where: { id: userId }, data: { [field]: relPath } });
  if (previousPath) await deleteProgressPhotoFile(previousPath);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const angle = body.angle;
  if (typeof angle !== "string" || !PHOTO_ANGLES.includes(angle as PhotoAngle)) {
    return NextResponse.json({ error: "invalid_angle" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const field = angleField(angle as PhotoAngle);
  const previousPath = user[field];
  if (previousPath) {
    await db.user.update({ where: { id: userId }, data: { [field]: null } });
    await deleteProgressPhotoFile(previousPath);
  }

  return NextResponse.json({ ok: true });
}
