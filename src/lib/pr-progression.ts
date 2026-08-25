export interface PrPoint {
  ms: number;
  value: number;
}

// Walks activities in date order and keeps only the points where a new
// personal record was set (value strictly greater than the previous best),
// producing a step-progression suitable for a "PR over time" sparkline.
// Appends one more point "now" at the final record's value, so the line
// visually extends to today instead of stopping at the date of the last PR.
export function computePrProgression(rows: { startedAtMs: number; value: number | null }[]): PrPoint[] {
  const sorted = [...rows]
    .filter((r): r is { startedAtMs: number; value: number } => r.value !== null && r.value > 0)
    .sort((a, b) => a.startedAtMs - b.startedAtMs);

  const points: PrPoint[] = [];
  let best = -Infinity;
  for (const r of sorted) {
    if (r.value > best) {
      best = r.value;
      points.push({ ms: r.startedAtMs, value: best });
    }
  }
  if (points.length > 0) {
    points.push({ ms: Date.now(), value: best });
  }
  return points;
}
