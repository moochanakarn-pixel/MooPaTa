import { describe, expect, it } from "vitest";
import { parseBodyCompositionText } from "./body-composition-import-parse";

describe("parseBodyCompositionText", () => {
  it("reads all 5 fields from a standard 5-line answer", () => {
    const text = `น้ำหนัก: 70.5
ไขมันในร่างกาย: 18.2
กล้ามเนื้อ: 32.1
ไขมันในช่องท้อง: 8
BMR: 1650`;
    expect(parseBodyCompositionText(text)).toEqual({
      weightKg: 70.5,
      bodyFatPercent: 18.2,
      skeletalMuscleMassKg: 32.1,
      visceralFatLevel: 8,
      inbodyReportedBmr: 1650,
    });
  });

  it("does not truncate a comma-thousands BMR figure (regression)", () => {
    expect(parseBodyCompositionText("BMR: 1,650").inbodyReportedBmr).toBe(1650);
  });

  it("excludes a 'target/control weight' line from the actual weightKg field", () => {
    const parsed = parseBodyCompositionText("น้ำหนักเป้าหมาย: 65\nน้ำหนัก: 70.5");
    expect(parsed.weightKg).toBe(70.5);
  });

  it("claims a visceral-fat line before the looser body-fat matcher can (matcher order)", () => {
    // "ไขมันในช่องท้อง" contains "ไขมัน", which the body-fat matcher alone
    // would also match — visceral must be checked first so this line goes
    // to visceralFatLevel, not bodyFatPercent.
    const parsed = parseBodyCompositionText("ไขมันในช่องท้อง: 8");
    expect(parsed.visceralFatLevel).toBe(8);
    expect(parsed.bodyFatPercent).toBeNull();
  });

  it("leaves a field null when its line never appears", () => {
    const parsed = parseBodyCompositionText("น้ำหนัก: 70.5");
    expect(parsed.bodyFatPercent).toBeNull();
    expect(parsed.inbodyReportedBmr).toBeNull();
  });

  it("only reads the first occurrence of a field, ignoring a duplicate line", () => {
    const parsed = parseBodyCompositionText("น้ำหนัก: 70\nน้ำหนัก: 999");
    expect(parsed.weightKg).toBe(70);
  });
});
