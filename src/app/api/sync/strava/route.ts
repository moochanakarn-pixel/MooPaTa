import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { StravaRateLimitError } from "@/lib/providers/strava";
import { getSessionUserId } from "@/lib/session";
import { syncStravaConnection } from "@/lib/sync-strava";

// Pulls new activities from Strava for the logged-in user. Safe to call
// repeatedly (e.g. from a "Sync now" button) — only activities after the
// most recent one we already have are requested, and deletions on Strava's
// side are reconciled too.
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
    const result = await syncStravaConnection(connection);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StravaRateLimitError) {
      return NextResponse.json(
        { error: "strava_rate_limited", retryAfterSec: err.retryAfterSec },
        { status: 429 }
      );
    }
    throw err;
  }
}
