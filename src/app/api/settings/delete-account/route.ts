import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { deauthorizeStrava } from "@/lib/providers/strava";
import { destroySession, getSessionUserId } from "@/lib/session";

// Permanently deletes the account: revokes Strava, then deletes the User row
// (ProviderConnection and Activity cascade via the schema's onDelete rules).
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

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

  return NextResponse.json({ ok: true });
}
