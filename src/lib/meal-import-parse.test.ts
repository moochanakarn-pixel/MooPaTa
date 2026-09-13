import { describe, expect, it } from "vitest";
import { parseMealText } from "./meal-import-parse";

describe("parseMealText — markdown table with a header row", () => {
  it("reads columns by detected header order, not a fixed position", () => {
    const text = `| อาหาร | โปรตีน | คาร์บ | ไขมัน | kcal | ปริมาณ |
|---|---|---|---|---|---|
| ข้าวผัด | 12 | 45 | 8 | 320 | 250 |`;
    const parsed = parseMealText(text);
    expect(parsed.items).toEqual([
      { name: "ข้าวผัด", grams: 250, calories: 320, proteinG: 12, carbG: 45, fatG: 8, hasRealGrams: true },
    ]);
  });

  it("does not truncate a comma-thousands calorie figure (regression)", () => {
    const text = `| อาหาร | ปริมาณ | kcal | โปรตีน | คาร์บ | ไขมัน |
|---|---|---|---|---|---|
| บุฟเฟต์ | 500 | 1,130 | 40 | 120 | 30 |`;
    expect(parseMealText(text).items[0].calories).toBe(1130);
  });
});

describe("parseMealText — default fixed layout (no header found)", () => {
  it("falls back to name/grams/kcal/protein/carb/fat in that order", () => {
    const text = "กระเพราหมูสับ | 300 | 450 | 25 | 30 | 20";
    const parsed = parseMealText(text);
    expect(parsed.items).toEqual([
      { name: "กระเพราหมูสับ", grams: 300, calories: 450, proteinG: 25, carbG: 30, fatG: 20, hasRealGrams: true },
    ]);
  });
});

describe("parseMealText — compact one-liner (no delimiter at all)", () => {
  it("tokenizes a plain-text summary line into the same 6 fields", () => {
    const parsed = parseMealText("ข้าวผัดกะเพราไก่ 300 ก. 450 kcal 25 ก. 55 ก. 15 ก.");
    expect(parsed.items).toEqual([
      { name: "ข้าวผัดกะเพราไก่", grams: 300, calories: 450, proteinG: 25, carbG: 55, fatG: 15, hasRealGrams: true },
    ]);
  });

  it("treats a serving with no grams column as an arbitrary denominator, not a real weight", () => {
    // e.g. "1 scoop of whey" — no separate weight cell, just totals
    const parsed = parseMealText("เวย์โปรตีน 1 สกู๊ป 120 kcal 24 ก. 3 ก. 1 ก.");
    expect(parsed.items[0].hasRealGrams).toBe(false);
    expect(parsed.items[0].calories).toBe(120);
    expect(parsed.items[0].proteinG).toBe(24);
  });

  it("does not misread a supplement's calcium amount as its calorie figure", () => {
    // "แคลเซียม 200 mg" starts with the same "แคล..." prefix as calories —
    // matchHeaderField's fuller pattern must not false-positive on it.
    const parsed = parseMealText("แคลเซียมเม็ด แคลเซียม 200 mg 5 kcal 0 ก. 1 ก. 0 ก.");
    expect(parsed.items[0].calories).toBe(5);
  });
});

describe("parseMealText — number parsing", () => {
  it("takes the midpoint of a range like '220-250'", () => {
    const parsed = parseMealText("ต้มยำกุ้ง | 300 | 220-250 | 20 | 15 | 10");
    expect(parsed.items[0].calories).toBe(235);
  });

  it("does not truncate a comma-thousands figure in the compact form (regression)", () => {
    const parsed = parseMealText("บุฟเฟต์รวม 1 มื้อ 1,850 kcal 90 ก. 200 ก. 60 ก.");
    expect(parsed.items[0].calories).toBe(1850);
  });
});

describe("parseMealText — water", () => {
  it("reads a water amount in ml from a leftover (non-food-row) line", () => {
    const parsed = parseMealText("ข้าวผัด | 300 | 450 | 25 | 30 | 20\nน้ำ 500 มล.");
    expect(parsed.waterMl).toBe(500);
  });

  it("does not read a soup serving's ml as water when it was consumed as a food row", () => {
    const text = `| อาหาร | ปริมาณ | kcal | โปรตีน | คาร์บ | ไขมัน |
|---|---|---|---|---|---|
| ต้มยำกุ้ง | 200 มล. | 150 | 15 | 10 | 5 |`;
    expect(parseMealText(text).waterMl).toBeNull();
  });

  it("returns null when nothing mentions water at all", () => {
    expect(parseMealText("ข้าวผัด | 300 | 450 | 25 | 30 | 20").waterMl).toBeNull();
  });
});

describe("parseMealText — rejecting non-data lines", () => {
  it("skips a markdown table separator row", () => {
    const text = `| อาหาร | ปริมาณ | kcal | โปรตีน | คาร์บ | ไขมัน |
|---|---|---|---|---|---|
| ข้าวผัด | 300 | 450 | 25 | 30 | 20 |`;
    expect(parseMealText(text).items).toHaveLength(1);
  });

  it("skips a 'รวม/สรุป' totals line instead of reading it as a dish", () => {
    const text = "ข้าวผัด | 300 | 450 | 25 | 30 | 20\nรวม | - | 450 | 25 | 30 | 20";
    expect(parseMealText(text).items).toHaveLength(1);
  });
});
