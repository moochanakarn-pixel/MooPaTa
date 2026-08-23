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

  // Only genuinely-absent values become blank cells; a real 0 (a gym session
  // with no distance, a flat route with no elevation gain) is exported as 0
  // rather than looking like missing data.
  const num = (value: number | null, transform: (n: number) => string): string =>
    value === null || value === undefined ? "" : transform(value);

  const rows = activities.map((a) =>
    [
      a.startedAt.toISOString(),
      a.type,
      a.name ?? "",
      num(a.distanceMeters, (n) => (n / 1000).toFixed(2)),
      (a.durationSec / 60).toFixed(1),
      num(a.elevationGainM, (n) => Math.round(n).toString()),
      num(a.avgHeartRate, (n) => Math.round(n).toString()),
      num(a.maxHeartRate, (n) => Math.round(n).toString()),
      num(a.avgSpeedMs, (n) => (n * 3.6).toFixed(1)),
      num(a.calories, (n) => Math.round(n).toString()),
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
