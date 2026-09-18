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

  // Progress photos (and the self-uploaded avatar) live as plain files on
  // disk, not a cascaded DB relation — Prisma's onDelete:Cascade drops the
  // ProgressPhotoLog rows but never touches the files they pointed at, so
  // they'd otherwise leak forever with no user id left to ever clean them
  // up by. Deleted before the DB row (not after) so that if this request
  // dies partway through, the failure mode is a User row that still exists
  // with its files already gone — recoverable by just retrying delete-account
  // — rather than files orphaned on disk with no surviving row to trace them
  // back to. Both delete helpers already treat a missing file as success, so
  // re-running this after a partial failure is safe.
  for (const log of progressPhotoLogs) {
    await deleteProgressPhotoFile(log.photoPath);
  }
  if (user?.avatarPath) await deleteAvatarFile(user.avatarPath);

  await db.user.delete({ where: { id: userId } });
  destroySession();

  return NextResponse.json({ ok: true });
}
