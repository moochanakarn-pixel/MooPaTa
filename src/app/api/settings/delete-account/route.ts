import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { deauthorizeStrava } from "@/lib/providers/strava";
import { deleteProgressPhotoFile } from "@/lib/progress-photo-storage";
import { destroySession, getSessionUserId } from "@/lib/session";

// Permanently deletes the account: revokes Strava, then deletes the User row
// (ProviderConnection and Activity cascade via the schema's onDelete rules).
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { frontPhotoPath: true, sidePhotoPath: true, backPhotoPath: true },
  });

  const connection = await db.providerConnection.findFirst({
    where: { userId, provider: "STRAVA" },
  });
  if (connection) {
    try {
      await deauthorizeStrava(decryptToken(connection.accessTokenEnc));
    } catch {
      // Best-effort — proceed with local deletion regardless.
    }
  }

  await db.user.delete({ where: { id: userId } });
  destroySession();

  // Progress photos live as plain files on disk, not a cascaded DB relation
  // — Prisma's onDelete:Cascade never touches them, so they'd otherwise
  // leak forever with no user id left to ever clean them up by.
  for (const relPath of [user?.frontPhotoPath, user?.sidePhotoPath, user?.backPhotoPath]) {
    if (relPath) await deleteProgressPhotoFile(relPath);
  }

  return NextResponse.json({ ok: true });
}
