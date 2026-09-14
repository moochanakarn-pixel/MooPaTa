import { describe, expect, it } from "vitest";
import { optionalNonNegative, parseExercises } from "./activity-validation";

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
          { reps: 8, weightKg: 60 },
          { reps: 8, weightKg: 60 },
        ],
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
      { reps: 15, weightKg: 5 },
      { reps: 14, weightKg: 5 },
      { reps: 10, weightKg: 4 },
    ]);
  });

  it("leaves weightKg null for a bodyweight set", () => {
    expect(parseExercises([{ name: "แพลงก์", sets: [{ reps: 1 }] }])).toEqual([
      { name: "แพลงก์", sets: [{ reps: 1, weightKg: null }] },
    ]);
  });

  it("fails the whole request (returns null) rather than dropping a bad row", () => {
    expect(parseExercises([{ name: "", sets: [{ reps: 8 }] }])).toBeNull(); // empty name
    expect(parseExercises([{ name: "ok", sets: [] }])).toBeNull(); // no sets at all
    expect(parseExercises([{ name: "ok", sets: [{ reps: 8.5 }] }])).toBeNull(); // reps must be an integer
    expect(parseExercises([{ name: "ok", sets: [{ reps: 0 }] }])).toBeNull(); // reps must be > 0
    expect(parseExercises([{ name: "ok", sets: Array.from({ length: 51 }, () => ({ reps: 8 })) }])).toBeNull(); // sets capped at 50
    expect(parseExercises([{ name: "ok", sets: [{ reps: 8, weightKg: "not a number" }] }])).toBeNull();
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
