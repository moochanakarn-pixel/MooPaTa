import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { deauthorizeStrava } from "@/lib/providers/strava";
import { getSessionUserId } from "@/lib/session";

// Disconnects Strava: revokes the token on Strava's side and removes the
// stored connection, so syncing stops. Existing historical activities are
// kept — this isn't the same as deleting the account.
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const connection = await db.providerConnection.findFirst({
    where: { userId, provider: "STRAVA" },
  });
  if (!connection) {
    return NextResponse.json({ error: "strava_not_connected" }, { status: 400 });
  }

  try {
    await deauthorizeStrava(decryptToken(connection.accessTokenEnc));
  } catch {
    // Best-effort: still remove our copy even if Strava's revoke call fails
    // (e.g. token already invalid) so the user isn't stuck.
  }

  await db.providerConnection.delete({ where: { id: connection.id } });

  return NextResponse.json({ ok: true });
}
