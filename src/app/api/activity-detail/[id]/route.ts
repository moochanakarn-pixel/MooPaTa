import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fetchStravaActivityDetail,
  fetchStravaActivityLaps,
  fetchStravaActivityStreams,
  StravaRateLimitError,
} from "@/lib/providers/strava";
import { getSessionUserId } from "@/lib/session";
import { downsampleStreams } from "@/lib/streams";
import { getValidStravaAccessToken } from "@/lib/strava-token";

// Fetches and caches the richer per-activity data Strava's summary list
// endpoint doesn't include (splits, best efforts, laps, device name,
// time-series streams) — on demand, only when the user actually opens this
// activity, since it costs 3 extra Strava API calls. Once cached it's never
// re-fetched (historical activities don't change).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const activity = await db.activity.findUnique({ where: { id: params.id } });
  if (!activity || activity.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (activity.provider !== "STRAVA") {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  const existing = await db.activityDetail.findUnique({ where: { activityId: activity.id } });
  if (existing) {
    return NextResponse.json({ cached: true });
  }

  const connection = await db.providerConnection.findFirst({
    where: { userId, provider: "STRAVA" },
  });
  if (!connection) {
    return NextResponse.json({ error: "strava_not_connected" }, { status: 400 });
  }

  try {
    const accessToken = await getValidStravaAccessToken(connection);
    const [detail, streams, laps] = await Promise.all([
      fetchStravaActivityDetail(accessToken, activity.providerActId),
      fetchStravaActivityStreams(accessToken, activity.providerActId),
      fetchStravaActivityLaps(accessToken, activity.providerActId),
    ]);

    await db.activityDetail.create({
      data: {
        activityId: activity.id,
        deviceName: detail.deviceName,
        splits: detail.splits as unknown as Prisma.InputJsonValue,
        bestEfforts: detail.bestEfforts as unknown as Prisma.InputJsonValue,
        laps: laps as unknown as Prisma.InputJsonValue,
        streams: downsampleStreams(streams) as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ cached: false });
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
