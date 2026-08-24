import type { StreamPoint } from "@/lib/streams";

export interface HrZoneResult {
  zone: number; // 1-5
  seconds: number;
  pct: number; // share of total classified time in this activity
}

// Standard 5-zone model as a percentage of max heart rate (Z1 < 60%, ...,
// Z5 >= 90%). Simple and doesn't need per-user zone configuration, which
// Strava/Huawei accounts here don't expose anyway.
function zoneForHr(hr: number, hrMax: number): number {
  const pct = hr / hrMax;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

const MIN_USABLE_SECONDS = 30;

// Buckets time spent in each HR zone from a downsampled stream. Prefers the
// "time" stream (elapsed seconds, exact) but falls back to distance/velocity
// to estimate the gap between points — needed for ActivityDetail rows cached
// before the time stream was added, which won't have it until re-fetched.
export function computeHrZones(points: StreamPoint[], hrMax: number): HrZoneResult[] | null {
  if (hrMax <= 0) return null;

  const totals = [0, 0, 0, 0, 0];
  let totalSeconds = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev.heartrate === undefined || cur.heartrate === undefined) continue;

    let dt: number | null = null;
    if (prev.time !== undefined && cur.time !== undefined) {
      dt = cur.time - prev.time;
    } else if (prev.velocity && prev.velocity > 0) {
      dt = (cur.distance - prev.distance) / prev.velocity;
    }
    if (dt === null || dt <= 0 || !Number.isFinite(dt)) continue;

    const avgHr = (prev.heartrate + cur.heartrate) / 2;
    totals[zoneForHr(avgHr, hrMax) - 1] += dt;
    totalSeconds += dt;
  }

  if (totalSeconds < MIN_USABLE_SECONDS) return null;

  return totals.map((seconds, i) => ({ zone: i + 1, seconds, pct: (seconds / totalSeconds) * 100 }));
}
