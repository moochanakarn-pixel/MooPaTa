import { Prisma, ProviderConnection } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchAllStravaActivityIds, fetchStravaActivities } from "@/lib/providers/strava";
import { getValidStravaAccessToken } from "@/lib/strava-token";

// Pulls new activities from Strava for one connection and upserts them into
// the normalized Activity table, then reconciles deletions. Shared by the
// user-triggered "sync now" route and the cron-driven auto-sync route so
// both stay in lockstep.
export async function syncStravaConnection(
  connection: ProviderConnection
): Promise<{ synced: number; deleted: number }> {
  const userId = connection.userId;
  const accessToken = await getValidStravaAccessToken(connection);

  const latest = await db.activity.findFirst({
    where: { userId, provider: "STRAVA" },
    orderBy: { startedAt: "desc" },
  });
  const afterUnix = latest ? Math.floor(latest.startedAt.getTime() / 1000) : undefined;

  const activities = await fetchStravaActivities(accessToken, afterUnix);

  for (const a of activities) {
    const fields = {
      type: a.type,
      name: a.name,
      startedAt: a.startedAt,
      durationSec: a.durationSec,
      distanceMeters: a.distanceMeters,
      elevationGainM: a.elevationGainM,
      elevHighM: a.elevHighM,
      elevLowM: a.elevLowM,
      avgHeartRate: a.avgHeartRate,
      maxHeartRate: a.maxHeartRate,
      avgSpeedMs: a.avgSpeedMs,
      maxSpeedMs: a.maxSpeedMs,
      avgCadence: a.avgCadence,
      avgWatts: a.avgWatts,
      kilojoules: a.kilojoules,
      sufferScore: a.sufferScore,
      calories: a.calories,
      kudosCount: a.kudosCount,
      achievementCount: a.achievementCount,
      prCount: a.prCount,
      commentCount: a.commentCount,
      gearId: a.gearId,
      timezone: a.timezone,
      startLat: a.startLat,
      startLng: a.startLng,
      raw: a.raw as Prisma.InputJsonValue,
    };

    await db.activity.upsert({
      where: { provider_providerActId: { provider: "STRAVA", providerActId: a.providerActId } },
      update: fields,
      create: { ...fields, provider: "STRAVA", providerActId: a.providerActId, userId },
    });
  }

  const currentStravaIds = await fetchAllStravaActivityIds(accessToken);
  const stored = await db.activity.findMany({
    where: { userId, provider: "STRAVA" },
    select: { id: true, providerActId: true },
  });
  const staleIds = stored.filter((s) => !currentStravaIds.has(s.providerActId)).map((s) => s.id);
  if (staleIds.length > 0) {
    await db.activity.deleteMany({ where: { id: { in: staleIds } } });
  }

  return { synced: activities.length, deleted: staleIds.length };
}
