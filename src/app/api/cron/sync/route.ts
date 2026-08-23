import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { StravaRateLimitError } from "@/lib/providers/strava";
import { syncStravaConnection } from "@/lib/sync-strava";

// Auto-sync endpoint for a server-side cron job (e.g. a VPS crontab hitting
// this with curl). Unlike /api/sync/strava this isn't tied to a browser
// session — auth is a shared secret instead, since a cron job has no cookie.
// See README for the crontab entry that calls this.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await db.providerConnection.findMany({ where: { provider: "STRAVA" } });

  const results: { userId: string; synced?: number; deleted?: number; error?: string }[] = [];

  for (const connection of connections) {
    try {
      const result = await syncStravaConnection(connection);
      results.push({ userId: connection.userId, ...result });
    } catch (err) {
      const message =
        err instanceof StravaRateLimitError ? "rate_limited" : err instanceof Error ? err.message : "unknown_error";
      results.push({ userId: connection.userId, error: message });
    }
  }

  return NextResponse.json({ usersProcessed: results.length, results });
}
