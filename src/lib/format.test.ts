import { describe, expect, it } from "vitest";
import {
  activitySpeedValue,
  activityTypeLabel,
  cadenceUnitLabel,
  formatDistanceKm,
  formatDuration,
  formatElevationM,
  formatPace,
  formatSignedElevation,
  formatSignedPace,
  formatSignedSwimPace,
  formatSpeedKmh,
  formatSwimPace,
  paceSecondsPerUnit,
  swimPaceSecondsPerUnit,
} from "./format";

describe("formatPace", () => {
  it("formats a run pace as min:sec per km", () => {
    // 1000m in 300s -> 3.333 m/s -> 300s/km -> "5:00 /กม."
    expect(formatPace(1000 / 300)).toBe("5:00 /กม.");
  });

  it("returns '-' for null, undefined, and zero speed", () => {
    expect(formatPace(null)).toBe("-");
    expect(formatPace(undefined)).toBe("-");
    expect(formatPace(0)).toBe("-"); // division by zero, not just "missing"
  });

  it("uses miles for imperial", () => {
    expect(formatPace(1609.344 / 300, "IMPERIAL")).toBe("5:00 /ไมล์");
  });
});

describe("formatSwimPace", () => {
  it("formats swim pace as min:sec per 100m, not km/h", () => {
    // avgSpeedMs = 100/120 -> 120s per 100m -> "2:00 /100 ม."
    expect(formatSwimPace(100 / 120)).toBe("2:00 /100 ม.");
  });

  it("uses 100yd for imperial", () => {
    // 91.44m (100yd) in 120s
    expect(formatSwimPace(91.44 / 120, "IMPERIAL")).toBe("2:00 /100 หลา");
  });

  it("returns '-' for null and zero speed", () => {
    expect(formatSwimPace(null)).toBe("-");
    expect(formatSwimPace(0)).toBe("-");
  });
});

describe("activitySpeedValue — the per-type dispatcher", () => {
  const speedMs = 100 / 120; // deliberately swim-shaped: 2:00/100m, or 20:00/km if misread as running pace

  it("uses running pace for Run", () => {
    expect(activitySpeedValue("Run", 1000 / 300)).toBe("5:00 /กม.");
  });

  it("uses swim pace (not km/h) for Swim — the bug this was added to fix", () => {
    expect(activitySpeedValue("Swim", speedMs)).toBe("2:00 /100 ม.");
    expect(activitySpeedValue("Swim", speedMs)).not.toBe(formatSpeedKmh(speedMs));
  });

  it("falls back to km/h speed for every other type", () => {
    for (const type of ["Ride", "Walk", "WeightTraining", "Football", "Badminton", "Workout", "SomeUnknownType"]) {
      expect(activitySpeedValue(type, 20 / 3.6)).toBe(formatSpeedKmh(20 / 3.6));
    }
  });
});

describe("cadenceUnitLabel", () => {
  it("uses rpm for cycling", () => {
    expect(cadenceUnitLabel("Ride")).toBe("rpm");
  });

  it("uses spm for everything else, not just running", () => {
    for (const type of ["Run", "Walk", "WeightTraining", "Football", "Workout", "SomeUnknownType"]) {
      expect(cadenceUnitLabel(type)).toBe("spm");
    }
  });
});

describe("pace diffs stay in the right unit per type", () => {
  it("paceSecondsPerUnit and formatSignedPace are per-km, not per-100m", () => {
    const a = paceSecondsPerUnit(1000 / 300); // 300 s/km
    const b = paceSecondsPerUnit(1000 / 305); // 305 s/km
    expect(formatSignedPace(a - b)).toBe("-0:05 /กม.");
  });

  it("swimPaceSecondsPerUnit and formatSignedSwimPace are per-100m", () => {
    const a = swimPaceSecondsPerUnit(100 / 120); // 120 s/100m
    const b = swimPaceSecondsPerUnit(100 / 125); // 125 s/100m
    expect(formatSignedSwimPace(a - b)).toBe("-0:05 /100 ม.");
  });
});

describe("formatDistanceKm", () => {
  it("formats metric and imperial", () => {
    expect(formatDistanceKm(5000)).toBe("5.00 กม.");
    expect(formatDistanceKm(1609.344, "IMPERIAL")).toBe("1.00 ไมล์");
  });

  it("returns '-' for null/undefined (missing, not zero)", () => {
    expect(formatDistanceKm(null)).toBe("-");
    expect(formatDistanceKm(undefined)).toBe("-");
  });
});

describe("formatDuration", () => {
  it("drops the hour part entirely under an hour", () => {
    expect(formatDuration(15 * 60)).toBe("15 นาที");
  });

  it("shows both hours and minutes at/above an hour", () => {
    expect(formatDuration(3600 + 15 * 60)).toBe("1 ชม. 15 น.");
  });
});

describe("formatElevationM / formatSignedElevation", () => {
  it("formats metric and imperial (converts to feet)", () => {
    expect(formatElevationM(500)).toBe("500 ม.");
    expect(formatElevationM(500, "IMPERIAL")).toBe("1640 ฟุต");
    expect(formatElevationM(500, "IMPERIAL", "en")).toBe("1640 ft");
  });

  it("returns '-' for null/undefined only, not zero", () => {
    expect(formatElevationM(null)).toBe("-");
    expect(formatElevationM(undefined)).toBe("-");
    expect(formatElevationM(0)).toBe("0 ม.");
  });

  // Regression: records/page.tsx and compare-view.tsx used to append a
  // raw "ม."/"m" string straight onto the meter value for the delta,
  // ignoring `unit` entirely — an IMPERIAL user saw a number of meters
  // mislabeled as feet.
  it("converts the delta to feet under IMPERIAL, not just relabels meters", () => {
    expect(formatSignedElevation(100, "IMPERIAL")).toBe("+328 ฟุต");
    expect(formatSignedElevation(-100, "IMPERIAL")).toBe("-328 ฟุต");
    expect(formatSignedElevation(100, "IMPERIAL", "en")).toBe("+328 ft");
  });

  it("formats metric deltas with a sign and no conversion", () => {
    expect(formatSignedElevation(50)).toBe("+50 ม.");
    expect(formatSignedElevation(-50)).toBe("-50 ม.");
    expect(formatSignedElevation(0)).toBe("0 ม.");
  });
});

describe("activityTypeLabel", () => {
  it("maps known types to Thai labels", () => {
    expect(activityTypeLabel("Run")).toBe("วิ่ง");
    expect(activityTypeLabel("Swim")).toBe("ว่ายน้ำ");
  });

  it("maps Strava's 'Soccer' sport_type to the same label as the form's 'Football'", () => {
    expect(activityTypeLabel("Soccer")).toBe(activityTypeLabel("Football"));
  });

  it("falls back to the raw type string for anything unrecognized", () => {
    expect(activityTypeLabel("SomeFutureType")).toBe("SomeFutureType");
  });
});
