import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const METERS_PER_MILE = 1609.344;

// A value starting with =, +, -, @ (or a tab/CR) is interpreted as a formula
// by Excel/Sheets when the CSV is opened there, not shown as literal text —
// e.g. an activity named `=HYPERLINK("http://evil","click")`, synced in
// verbatim from Strava or typed into the manual-log form. Prefixing with a
// leading apostrophe forces it to render as text; MooPaTa itself never
// re-imports this file, so the prefix has no other effect.
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvEscape(value: string): string {
  const safe = CSV_FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { unitSystem: true } });
  const imperial = user?.unitSystem === "IMPERIAL";

  const activities = await db.activity.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });

  // Matches the unit system shown everywhere else in the app (src/lib/format.ts)
  // — exporting km/kmh regardless of the user's own IMPERIAL preference used
  // to read as a mismatch when cross-checking numbers against the dashboard.
  const columns = [
    "date",
    "type",
    "name",
    imperial ? "distance_mi" : "distance_km",
    "duration_min",
    imperial ? "elevation_gain_ft" : "elevation_gain_m",
    "avg_heart_rate",
    "max_heart_rate",
    imperial ? "avg_speed_mph" : "avg_speed_kmh",
    "calories",
  ] as const;

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
      num(a.distanceMeters, (n) => (imperial ? n / METERS_PER_MILE : n / 1000).toFixed(2)),
      (a.durationSec / 60).toFixed(1),
      num(a.elevationGainM, (n) => Math.round(imperial ? n * 3.28084 : n).toString()),
      num(a.avgHeartRate, (n) => Math.round(n).toString()),
      num(a.maxHeartRate, (n) => Math.round(n).toString()),
      num(a.avgSpeedMs, (n) => (imperial ? n * 2.236936 : n * 3.6).toFixed(1)),
      num(a.calories, (n) => Math.round(n).toString()),
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );

  const csv = [columns.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="moopata-activities.csv"`,
    },
  });
}
