import { describe, expect, it } from "vitest";
import { computeAvgSpeedMs, isFutureDate, optionalNonNegative, optionalNotes, optionalRpe, parseExercises } from "./activity-validation";

describe("parseExercises", () => {
  it("returns an empty array when the field wasn't sent at all", () => {
    expect(parseExercises(undefined)).toEqual([]);
    expect(parseExercises(null)).toEqual([]);
  });

  it("parses a valid row with a uniform set list", () => {
    expect(
      parseExercises([
        {
          name: " สควอท ",
          sets: [
            { reps: 8, weightKg: 60 },
            { reps: 8, weightKg: 60 },
          ],
        },
      ])
    ).toEqual([
      {
        name: "สควอท",
        sets: [
          { reps: 8, weightKg: 60, rpe: null },
          { reps: 8, weightKg: 60, rpe: null },
        ],
        notes: null,
      },
    ]);
  });

  it("keeps each set's own reps/weight for a pyramid/drop set", () => {
    const result = parseExercises([
      {
        name: "เบนช์เพรส",
        sets: [
          { reps: 15, weightKg: 5 },
          { reps: 14, weightKg: 5 },
          { reps: 10, weightKg: 4 },
        ],
      },
    ]);
    expect(result![0].sets).toEqual([
      { reps: 15, weightKg: 5, rpe: null },
      { reps: 14, weightKg: 5, rpe: null },
      { reps: 10, weightKg: 4, rpe: null },
    ]);
  });

  it("leaves weightKg null for a bodyweight set", () => {
    expect(parseExercises([{ name: "แพลงก์", sets: [{ reps: 1 }] }])).toEqual([
      { name: "แพลงก์", sets: [{ reps: 1, weightKg: null, rpe: null }], notes: null },
    ]);
  });

  it("trims and keeps a per-exercise note, and truncates one over the column limit", () => {
    const withNote = parseExercises([{ name: "สควอท", sets: [{ reps: 8 }], notes: "  รอบหน้าลดน้ำหนักลงนิดหน่อย  " }]);
    expect(withNote![0].notes).toBe("รอบหน้าลดน้ำหนักลงนิดหน่อย");

    const tooLong = parseExercises([{ name: "สควอท", sets: [{ reps: 8 }], notes: "a".repeat(600) }]);
    expect(tooLong![0].notes).toHaveLength(500);
  });

  it("keeps each set's own RPE", () => {
    const result = parseExercises([
      {
        name: "เบนช์เพรส",
        sets: [
          { reps: 15, weightKg: 5, rpe: 8 },
          { reps: 10, weightKg: 4, rpe: 9 },
        ],
      },
    ]);
    expect(result![0].sets).toEqual([
      { reps: 15, weightKg: 5, rpe: 8 },
      { reps: 10, weightKg: 4, rpe: 9 },
    ]);
  });

  it("fails the whole request (returns null) rather than dropping a bad row", () => {
    expect(parseExercises([{ name: "", sets: [{ reps: 8 }] }])).toBeNull(); // empty name
    expect(parseExercises([{ name: "ok", sets: [] }])).toBeNull(); // no sets at all
    expect(parseExercises([{ name: "ok", sets: [{ reps: 8.5 }] }])).toBeNull(); // reps must be an integer
    expect(parseExercises([{ name: "ok", sets: [{ reps: 0 }] }])).toBeNull(); // reps must be > 0
    expect(parseExercises([{ name: "ok", sets: Array.from({ length: 51 }, () => ({ reps: 8 })) }])).toBeNull(); // sets capped at 50
    expect(parseExercises([{ name: "ok", sets: [{ reps: 8, weightKg: "not a number" }] }])).toBeNull();
    expect(parseExercises([{ name: "ok", sets: [{ reps: 8, rpe: 11 }] }])).toBeNull(); // rpe must be 1-10
    expect(parseExercises([{ name: "ok", sets: [{ reps: 8, rpe: 0 }] }])).toBeNull();
    expect(parseExercises([{ name: "ok", sets: "not an array" }])).toBeNull();
  });

  it("rejects a non-array value and a too-long exercise list", () => {
    expect(parseExercises("not an array")).toBeNull();
    const tooMany = Array.from({ length: 31 }, () => ({ name: "x", sets: [{ reps: 1 }] }));
    expect(parseExercises(tooMany)).toBeNull();
  });
});

describe("optionalNonNegative", () => {
  it("returns null when the value wasn't provided at all", () => {
    expect(optionalNonNegative(undefined)).toBeNull();
    expect(optionalNonNegative(null)).toBeNull();
    expect(optionalNonNegative("")).toBeNull();
    expect(optionalNonNegative("   ")).toBeNull();
  });

  it("returns the number when provided and valid", () => {
    expect(optionalNonNegative(42)).toBe(42);
    expect(optionalNonNegative("42")).toBe(42);
    expect(optionalNonNegative(0)).toBe(0);
  });

  it("signals 'provided but invalid' as NaN, distinct from 'not provided' (null)", () => {
    expect(optionalNonNegative("abc")).toBeNaN();
    expect(optionalNonNegative(-5)).toBeNaN(); // provided, but negative isn't allowed
    expect(optionalNonNegative("-5")).toBeNaN();
  });
});

describe("optionalRpe", () => {
  it("returns null when the value wasn't provided at all", () => {
    expect(optionalRpe(undefined)).toBeNull();
    expect(optionalRpe(null)).toBeNull();
    expect(optionalRpe("")).toBeNull();
    expect(optionalRpe("   ")).toBeNull();
  });

  it("returns the number when provided and within 1-10", () => {
    expect(optionalRpe(8)).toBe(8);
    expect(optionalRpe("8")).toBe(8);
    expect(optionalRpe(1)).toBe(1);
    expect(optionalRpe(10)).toBe(10);
  });

  it("allows half-point steps within 1-10", () => {
    expect(optionalRpe(8.5)).toBe(8.5);
    expect(optionalRpe("7.5")).toBe(7.5);
    expect(optionalRpe(1)).toBe(1); // whole numbers are still fine
    expect(optionalRpe(9.5)).toBe(9.5);
  });

  it("signals 'provided but invalid' as NaN for out-of-range or non-half-step values", () => {
    expect(optionalRpe(0)).toBeNaN(); // below 1
    expect(optionalRpe(11)).toBeNaN(); // above 10
    expect(optionalRpe(8.3)).toBeNaN(); // not a half-point step
    expect(optionalRpe(8.1)).toBeNaN();
    expect(optionalRpe("abc")).toBeNaN();
  });
});

describe("computeAvgSpeedMs", () => {
  it("derives m/s from distance and duration (5.02 km in 40 min)", () => {
    // 5.02 km / (40 * 60) s = 2.0916... m/s
    expect(computeAvgSpeedMs(5.02, 40)).toBeCloseTo(2.0917, 3);
  });

  it("returns null when distance wasn't provided", () => {
    expect(computeAvgSpeedMs(null, 40)).toBeNull();
  });

  it("returns null for zero or negative distance/duration", () => {
    expect(computeAvgSpeedMs(0, 40)).toBeNull();
    expect(computeAvgSpeedMs(-1, 40)).toBeNull();
    expect(computeAvgSpeedMs(5, 0)).toBeNull();
    expect(computeAvgSpeedMs(5, -1)).toBeNull();
  });
});

describe("isFutureDate", () => {
  it("is true for a date after now", () => {
    expect(isFutureDate(new Date(Date.now() + 60_000))).toBe(true);
  });

  it("is false for now or a date in the past", () => {
    expect(isFutureDate(new Date(Date.now() - 60_000))).toBe(false);
    expect(isFutureDate(new Date("2020-01-01"))).toBe(false);
  });
});

describe("optionalNotes", () => {
  it("returns null when not provided, blank, or the wrong type", () => {
    expect(optionalNotes(undefined)).toBeNull();
    expect(optionalNotes(null)).toBeNull();
    expect(optionalNotes("")).toBeNull();
    expect(optionalNotes("   ")).toBeNull();
    expect(optionalNotes(42)).toBeNull();
  });

  it("trims and returns the text as-is when within the limit", () => {
    expect(optionalNotes("  Training Effect: 2.1 (ดี)  ")).toBe("Training Effect: 2.1 (ดี)");
  });

  it("clips to 500 chars rather than rejecting an over-length note", () => {
    const long = "a".repeat(600);
    const result = optionalNotes(long);
    expect(result).toHaveLength(500);
    expect(result).toBe("a".repeat(500));
  });
});
