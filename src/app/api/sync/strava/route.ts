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

  // The DB lookup is inside the try too: if the database is behind on
  // migrations, Prisma throws right here, and leaving it uncaught produced
  // exactly the empty-bodied 500 this handler exists to avoid.
  try {
    const connection = await db.providerConnection.findFirst({
      where: { userId, provider: "STRAVA" },
    });
    if (!connection) {
      return NextResponse.json({ error: "strava_not_connected" }, { status: 400 });
    }

    const result = await syncStravaConnection(connection);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StravaRateLimitError) {
      return NextResponse.json(
        { error: "strava_rate_limited", retryAfterSec: err.retryAfterSec },
        { status: 429 }
      );
    }

    // Anything else (expired/revoked token, Strava outage, network failure,
    // out-of-date database) used to rethrow, which Next turns into an
    // empty-bodied 500 — the UI then had nothing to show but a generic
    // "sync failed". Return the real reason so the user can act on it.
    console.error("Strava sync failed", err);
    const message = err instanceof Error ? err.message : String(err);
    const isAuthFailure = /401|refresh failed|invalid_grant/i.test(message);
    const isSchemaMismatch = /does ?n[o']?t exist|Unknown column|Unknown argument|no such table/i.test(message);

    if (isSchemaMismatch) {
      return NextResponse.json(
        {
          error: "database_out_of_date",
          detail: "ฐานข้อมูลยังไม่ได้อัปเดตตามโค้ดล่าสุด — รัน: npx prisma migrate deploy",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: isAuthFailure ? "strava_auth_expired" : "sync_failed",
        detail: message,
      },
      { status: isAuthFailure ? 401 : 500 }
    );
  }
}
