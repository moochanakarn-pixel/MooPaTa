import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const COLUMNS = [
  "date",
  "type",
  "name",
  "distance_km",
  "duration_min",
  "elevation_gain_m",
  "avg_heart_rate",
  "max_heart_rate",
  "avg_speed_kmh",
  "calories",
] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const activities = await db.activity.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });

  const rows = activities.map((a) =>
    [
      a.startedAt.toISOString(),
      a.type,
      a.name ?? "",
      a.distanceMeters ? (a.distanceMeters / 1000).toFixed(2) : "",
      (a.durationSec / 60).toFixed(1),
      a.elevationGainM ? Math.round(a.elevationGainM).toString() : "",
      a.avgHeartRate ? Math.round(a.avgHeartRate).toString() : "",
      a.maxHeartRate ? Math.round(a.maxHeartRate).toString() : "",
      a.avgSpeedMs ? (a.avgSpeedMs * 3.6).toFixed(1) : "",
      a.calories ? Math.round(a.calories).toString() : "",
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );

  const csv = [COLUMNS.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="moopata-activities.csv"`,
    },
  });
}
