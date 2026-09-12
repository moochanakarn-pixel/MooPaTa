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

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { frontPhotoPath: true, sidePhotoPath: true, backPhotoPath: true, avatarPath: true },
  });

  await db.user.delete({ where: { id: userId } });
  destroySession();

  // Progress photos (and the self-uploaded avatar) live as plain files on
  // disk, not a cascaded DB relation — Prisma's onDelete:Cascade never
  // touches them, so they'd otherwise leak forever with no user id left to
  // ever clean them up by.
  for (const relPath of [user?.frontPhotoPath, user?.sidePhotoPath, user?.backPhotoPath]) {
    if (relPath) await deleteProgressPhotoFile(relPath);
  }
  if (user?.avatarPath) await deleteAvatarFile(user.avatarPath);

  return NextResponse.json({ ok: true });
}
