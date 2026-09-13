import { describe, expect, it } from "vitest";
import { computePrProgression } from "./pr-progression";

describe("computePrProgression", () => {
  it("keeps only points where a new record was set, in chronological order", () => {
    const rows = [
      { startedAtMs: 3, value: 5 },
      { startedAtMs: 1, value: 10 }, // earliest, becomes the first PR
      { startedAtMs: 2, value: 8 }, // between the two, but not a new record
    ];
    const points = computePrProgression(rows);
    // first two entries: the initial PR, then the "now" tail point
    expect(points[0]).toEqual({ ms: 1, value: 10 });
    expect(points).toHaveLength(2); // the 8 never beats 10, and 5 (at ms 3) doesn't either
  });

  it("appends a final 'now' point at the best value, extending the line to today", () => {
    const points = computePrProgression([{ startedAtMs: 100, value: 5 }]);
    expect(points[points.length - 1].value).toBe(5);
    expect(points[points.length - 1].ms).toBeGreaterThan(100);
  });

  it("ignores null and non-positive values", () => {
    const rows = [
      { startedAtMs: 1, value: null },
      { startedAtMs: 2, value: 0 },
      { startedAtMs: 3, value: -5 },
    ];
    expect(computePrProgression(rows)).toEqual([]);
  });

  it("returns an empty array for no rows at all", () => {
    expect(computePrProgression([])).toEqual([]);
  });

  it("produces one step per new record for a strictly increasing series", () => {
    const rows = [
      { startedAtMs: 1, value: 5 },
      { startedAtMs: 2, value: 10 },
      { startedAtMs: 3, value: 15 },
    ];
    const points = computePrProgression(rows);
    expect(points.map((p) => p.value)).toEqual([5, 10, 15, 15]); // + the "now" tail
  });
});
