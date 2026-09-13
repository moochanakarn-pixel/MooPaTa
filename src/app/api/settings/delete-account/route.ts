import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteAvatarFile } from "@/lib/avatar-storage";
import { deleteProgressPhotoFile } from "@/lib/progress-photo-storage";
import { destroySession, getSessionUserId } from "@/lib/session";

// Permanently deletes the account (ProviderConnection and Activity cascade
// via the schema's onDelete rules).
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const [user, progressPhotoLogs] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { avatarPath: true } }),
    db.progressPhotoLog.findMany({ where: { userId }, select: { photoPath: true } }),
  ]);

  await db.user.delete({ where: { id: userId } });
  destroySession();

  // Progress photos (and the self-uploaded avatar) live as plain files on
  // disk, not a cascaded DB relation — Prisma's onDelete:Cascade drops the
  // ProgressPhotoLog rows but never touches the files they pointed at, so
  // they'd otherwise leak forever with no user id left to ever clean them
  // up by.
  for (const log of progressPhotoLogs) {
    await deleteProgressPhotoFile(log.photoPath);
  }
  if (user?.avatarPath) await deleteAvatarFile(user.avatarPath);

  return NextResponse.json({ ok: true });
}
