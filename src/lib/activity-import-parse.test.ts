import { describe, expect, it } from "vitest";
import { parseActivityText } from "./activity-import-parse";

describe("parseActivityText", () => {
  it("reads a full AI-answer block into every field", () => {
    const text = `ประเภท: วิ่ง
ระยะเวลา: 45
ระยะทาง: 7.2
แคลอรี่: 420
หัวใจเฉลี่ย: 145
หัวใจสูงสุด: 172`;
    const parsed = parseActivityText(text);
    expect(parsed).toMatchObject({
      type: "Run",
      durationMin: 45,
      distanceKm: 7.2,
      calories: 420,
      avgHeartRate: 145,
      maxHeartRate: 172,
    });
  });

  it("does not truncate a comma-thousands calorie figure at the comma (regression)", () => {
    // This exact bug shipped once: "\d*" stopped matching at the first
    // comma, so parseFloat("1") came out of "แคลอรี่: 1,130" instead of 1130.
    const parsed = parseActivityText("แคลอรี่: 1,130");
    expect(parsed.calories).toBe(1130);
  });

  it("parses HH:MM:SS duration text into total minutes", () => {
    expect(parseActivityText("ระยะเวลา: 02:53:39").durationMin).toBe(174); // 2*60 + 53 + 39/60, rounded
  });

  it("does not misread a bare 'MM:SS'-shaped duration as hours", () => {
    // A two-group time with no explicit hour is ambiguous — falls back to
    // reading it as a plain number rather than guessing "45 hours 30 min."
    expect(parseActivityText("ระยะเวลา: 45:30").durationMin).toBe(45);
  });

  it("matches activity type keywords in both Thai and English", () => {
    expect(parseActivityText("ประเภท: วิ่ง").type).toBe("Run");
    expect(parseActivityText("Type: running").type).toBe("Run");
    expect(parseActivityText("ประเภท: เวทเทรนนิ่ง").type).toBe("WeightTraining");
    expect(parseActivityText("ประเภท: ปั่นจักรยาน").type).toBe("Ride");
  });

  it("only reads the first occurrence of a field, ignoring a repeated one later", () => {
    const parsed = parseActivityText("แคลอรี่: 300\nแคลอรี่: 999");
    expect(parsed.calories).toBe(300);
  });

  it("returns all-null/empty for text with nothing recognizable", () => {
    const parsed = parseActivityText("สวัสดีครับ วันนี้อากาศดี");
    expect(parsed.type).toBeNull();
    expect(parsed.durationMin).toBeNull();
    expect(parsed.exercises).toEqual([]);
  });

  it("parses the weight-training exercise table appended after the main fields", () => {
    const text = `ประเภท: เวทเทรนนิ่ง
ระยะเวลา: 60

ท่า:
ดันไหล่ดัมเบล | 3 | 12 | 20
สควอท | 4 | 8 | 60`;
    const parsed = parseActivityText(text);
    expect(parsed.exercises).toEqual([
      { name: "ดันไหล่ดัมเบล", sets: 3, reps: 12, weightKg: 20 },
      { name: "สควอท", sets: 4, reps: 8, weightKg: 60 },
    ]);
  });

  it("leaves weightKg null for a bodyweight exercise row with no 4th column", () => {
    const parsed = parseActivityText("แพลงก์ | 3 | 1");
    expect(parsed.exercises).toEqual([{ name: "แพลงก์", sets: 3, reps: 1, weightKg: null }]);
  });
});
