import { describe, expect, it } from "vitest";
import { optionalNonNegative, parseExercises } from "./activity-validation";

describe("parseExercises", () => {
  it("returns an empty array when the field wasn't sent at all", () => {
    expect(parseExercises(undefined)).toEqual([]);
    expect(parseExercises(null)).toEqual([]);
  });

  it("parses a valid row, trimming the name and rounding-through sets/reps", () => {
    expect(parseExercises([{ name: " สควอท ", sets: 4, reps: 8, weightKg: 60 }])).toEqual([
      { name: "สควอท", sets: 4, reps: 8, weightKg: 60 },
    ]);
  });

  it("leaves weightKg null for a bodyweight exercise", () => {
    expect(parseExercises([{ name: "แพลงก์", sets: 3, reps: 1 }])).toEqual([
      { name: "แพลงก์", sets: 3, reps: 1, weightKg: null },
    ]);
  });

  it("fails the whole request (returns null) rather than dropping a bad row", () => {
    expect(parseExercises([{ name: "", sets: 3, reps: 8 }])).toBeNull(); // empty name
    expect(parseExercises([{ name: "ok", sets: 0, reps: 8 }])).toBeNull(); // sets must be > 0
    expect(parseExercises([{ name: "ok", sets: 3, reps: 8.5 }])).toBeNull(); // reps must be an integer
    expect(parseExercises([{ name: "ok", sets: 51, reps: 8 }])).toBeNull(); // sets capped at 50
    expect(parseExercises([{ name: "ok", sets: 3, reps: 8, weightKg: "not a number" }])).toBeNull();
  });

  it("rejects a non-array value and a too-long list", () => {
    expect(parseExercises("not an array")).toBeNull();
    const tooMany = Array.from({ length: 31 }, () => ({ name: "x", sets: 1, reps: 1 }));
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
