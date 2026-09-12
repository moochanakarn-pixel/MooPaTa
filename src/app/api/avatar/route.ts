import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { contentTypeForAvatarPath, deleteAvatarFile, readAvatarFile, saveAvatar } from "@/lib/avatar-storage";

// GET streams the CURRENT user's own uploaded avatar — the path always
// comes from their own User row via the session, never from anything in
// the request, so this URL is a fixed "/api/avatar" for everyone and
// still can't be used to fetch someone else's picture.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.avatarPath) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buf = await readAvatarFile(user.avatarPath);
  if (!buf) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": contentTypeForAvatarPath(user.avatarPath), "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let relPath: string;
  try {
    relPath = await saveAvatar(userId, file);
  } catch (err) {
    const code = err instanceof Error ? err.message : "upload_failed";
    return NextResponse.json({ error: code }, { status: code === "too_large" ? 413 : 400 });
  }

  const previousPath = user.avatarPath;
  await db.user.update({ where: { id: userId }, data: { avatarPath: relPath } });
  if (previousPath) await deleteAvatarFile(previousPath);

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (user?.avatarPath) {
    await db.user.update({ where: { id: userId }, data: { avatarPath: null } });
    await deleteAvatarFile(user.avatarPath);
  }

  return NextResponse.json({ ok: true });
}
