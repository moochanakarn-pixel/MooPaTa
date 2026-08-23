import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { fetchStravaActivities, refreshStravaToken } from "@/lib/providers/strava";
import { getSessionUserId } from "@/lib/session";

// Pulls new activities from Strava for the logged-in user and upserts them
// into the normalized Activity table. Safe to call repeatedly (e.g. from a
// cron job or a "Sync now" button) — only activities after the most recent
// one we already have are requested.
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

  let accessToken = decryptToken(connection.accessTokenEnc);

  // Refresh proactively if the token is expired or expiring within 5 minutes.
  if (connection.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const refreshToken = decryptToken(connection.refreshTokenEnc);
    const refreshed = await refreshStravaToken(refreshToken);
    accessToken = refreshed.accessToken;
    await db.providerConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: encryptToken(refreshed.accessToken),
        refreshTokenEnc: encryptToken(refreshed.refreshToken),
        expiresAt: refreshed.expiresAt,
      },
    });
  }

  const latest = await db.activity.findFirst({
    where: { userId, provider: "STRAVA" },
    orderBy: { startedAt: "desc" },
  });
  const afterUnix = latest ? Math.floor(latest.startedAt.getTime() / 1000) : undefined;

  const activities = await fetchStravaActivities(accessToken, afterUnix);

  for (const a of activities) {
    await db.activity.upsert({
      where: { provider_providerActId: { provider: "STRAVA", providerActId: a.providerActId } },
      update: {
        type: a.type,
        name: a.name,
        startedAt: a.startedAt,
        durationSec: a.durationSec,
        distanceMeters: a.distanceMeters,
        elevationGainM: a.elevationGainM,
        avgHeartRate: a.avgHeartRate,
        calories: a.calories,
        raw: a.raw as Prisma.InputJsonValue,
      },
      create: {
        provider: "STRAVA",
        providerActId: a.providerActId,
        type: a.type,
        name: a.name,
        startedAt: a.startedAt,
        durationSec: a.durationSec,
        distanceMeters: a.distanceMeters,
        elevationGainM: a.elevationGainM,
        avgHeartRate: a.avgHeartRate,
        calories: a.calories,
        raw: a.raw as Prisma.InputJsonValue,
        userId,
      },
    });
  }

  return NextResponse.json({ synced: activities.length });
}
