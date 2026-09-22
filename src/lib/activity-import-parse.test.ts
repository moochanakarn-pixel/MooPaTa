import { describe, expect, it } from "vitest";
import { parseActivityText } from "./activity-import-parse";

describe("parseActivityText", () => {
  it("reads a full AI-answer block into every field", () => {
    const text = `ประเภท: วิ่ง
ระยะเวลา: 45
ระยะทาง: 7.2
แคลอรี่: 420
หัวใจเฉลี่ย: 145
หัวใจสูงสุด: 172
ระดับความเหนื่อย: 7`;
    const parsed = parseActivityText(text);
    expect(parsed).toMatchObject({
      type: "Run",
      durationMin: 45,
      distanceKm: 7.2,
      calories: 420,
      avgHeartRate: 145,
      maxHeartRate: 172,
      rpe: 7,
    });
  });

  it("also matches the English 'RPE' keyword", () => {
    expect(parseActivityText("RPE: 6").rpe).toBe(6);
  });

  it("keeps a half-point whole-session RPE as-is (no rounding, unlike per-set RPE)", () => {
    expect(parseActivityText("ระดับความเหนื่อย: 7.5").rpe).toBe(7.5);
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

  it("parses one row per set, grouped by exercise name, from the table appended after the main fields", () => {
    const text = `ประเภท: เวทเทรนนิ่ง
ระยะเวลา: 60

ท่า:
ดันไหล่ดัมเบล | 1 | 12 | 20
ดันไหล่ดัมเบล | 2 | 12 | 20
สควอท | 1 | 8 | 60`;
    const parsed = parseActivityText(text);
    expect(parsed.exercises).toEqual([
      {
        name: "ดันไหล่ดัมเบล",
        notes: null,
        sets: [
          { reps: 12, weightKg: 20, rpe: null },
          { reps: 12, weightKg: 20, rpe: null },
        ],
      },
      { name: "สควอท", notes: null, sets: [{ reps: 8, weightKg: 60, rpe: null }] },
    ]);
  });

  it("keeps each set's own reps/weight for a pyramid/drop set instead of one uniform row", () => {
    const text = `ท่า:
ดันไหล่ดัมเบล | 1 | 15 | 5
ดันไหล่ดัมเบล | 2 | 14 | 5
ดันไหล่ดัมเบล | 3 | 10 | 4`;
    const parsed = parseActivityText(text);
    expect(parsed.exercises).toEqual([
      {
        name: "ดันไหล่ดัมเบล",
        notes: null,
        sets: [
          { reps: 15, weightKg: 5, rpe: null },
          { reps: 14, weightKg: 5, rpe: null },
          { reps: 10, weightKg: 4, rpe: null },
        ],
      },
    ]);
  });

  it("reads an optional 5th-column RPE per set", () => {
    const text = `ท่า:
ดันไหล่ดัมเบล | 1 | 15 | 5 | 8
ดันไหล่ดัมเบล | 2 | 10 | 4 | 9`;
    const parsed = parseActivityText(text);
    expect(parsed.exercises).toEqual([
      {
        name: "ดันไหล่ดัมเบล",
        notes: null,
        sets: [
          { reps: 15, weightKg: 5, rpe: 8 },
          { reps: 10, weightKg: 4, rpe: 9 },
        ],
      },
    ]);
  });

  it("rounds a decimal per-set RPE to the nearest half-point rather than the nearest integer", () => {
    const text = `ท่า:
ดันไหล่ดัมเบล | 1 | 15 | 5 | 7.6
ดันไหล่ดัมเบล | 2 | 10 | 4 | 8.2`;
    const parsed = parseActivityText(text);
    expect(parsed.exercises).toEqual([
      {
        name: "ดันไหล่ดัมเบล",
        notes: null,
        sets: [
          { reps: 15, weightKg: 5, rpe: 7.5 },
          { reps: 10, weightKg: 4, rpe: 8 },
        ],
      },
    ]);
  });

  it("groups sets for the same exercise even when rows are interleaved with another exercise", () => {
    const text = `ท่า:
ดันไหล่ดัมเบล | 1 | 12 | 20
สควอท | 1 | 8 | 60
ดันไหล่ดัมเบล | 2 | 10 | 20`;
    const parsed = parseActivityText(text);
    expect(parsed.exercises).toEqual([
      {
        name: "ดันไหล่ดัมเบล",
        notes: null,
        sets: [{ reps: 12, weightKg: 20, rpe: null }, { reps: 10, weightKg: 20, rpe: null }],
      },
      { name: "สควอท", notes: null, sets: [{ reps: 8, weightKg: 60, rpe: null }] },
    ]);
  });

  it("leaves weightKg null for a bodyweight exercise row with no weight column", () => {
    const parsed = parseActivityText("แพลงก์ | 1 | 30");
    expect(parsed.exercises).toEqual([{ name: "แพลงก์", notes: null, sets: [{ reps: 30, weightKg: null, rpe: null }] }]);
  });

  it("does not shift RPE into weightKg for a bodyweight set with a blank weight column but an RPE value (regression)", () => {
    // Blindly filtering out every empty cell (not just leading/trailing
    // ones from markdown "| a | b |" padding) used to collapse the blank
    // weight column here, shifting "9" from the RPE column into weightKg
    // and losing the RPE entirely.
    const parsed = parseActivityText("ดึงข้อ | 1 | 8 |  | 9");
    expect(parsed.exercises).toEqual([{ name: "ดึงข้อ", notes: null, sets: [{ reps: 8, weightKg: null, rpe: 9 }] }]);
  });

  it("still strips a genuine leading/trailing pipe from markdown table padding", () => {
    const parsed = parseActivityText("| ดันไหล่ดัมเบล | 1 | 15 | 5 | 8 |");
    expect(parsed.exercises).toEqual([{ name: "ดันไหล่ดัมเบล", notes: null, sets: [{ reps: 15, weightKg: 5, rpe: 8 }] }]);
  });

  it("reads an optional 6th-column note, filed against the exercise once even if only one row has it", () => {
    const text = `ท่า:
สควอท | 1 | 15 | 60 | 8
สควอท | 2 | 14 | 60 | 8
สควอท | 3 | 10 | 65 | 9 | รอบหน้าเพิ่มน้ำหนัก`;
    const parsed = parseActivityText(text);
    expect(parsed.exercises[0].notes).toBe("รอบหน้าเพิ่มน้ำหนัก");
  });

  it("treats a bare '-' in the notes column as no note, same as every other optional field", () => {
    const parsed = parseActivityText("สควอท | 1 | 10 | 60 | 8 | -");
    expect(parsed.exercises[0].notes).toBeNull();
  });

  it("leaves notes null when the row has no 6th column at all", () => {
    const parsed = parseActivityText("สควอท | 1 | 10 | 60 | 8");
    expect(parsed.exercises[0].notes).toBeNull();
  });

  it("keeps a literal '|' inside the note instead of splitting it into a dropped extra column", () => {
    const parsed = parseActivityText("สควอท | 1 | 10 | 60 | 8 | ทำได้ดี | ยกง่าย");
    expect(parsed.exercises[0].notes).toBe("ทำได้ดี | ยกง่าย");
  });

  it("keeps the leading digits of a real exercise name (regression)", () => {
    // "21s" (twenty-ones) is a real lifting technique name — the old
    // digit-stripping regex mangled any leading number regardless of what
    // followed it, turning this into "s Bicep Curl".
    const parsed = parseActivityText("21s Bicep Curl | 1 | 21 | 15 | 8");
    expect(parsed.exercises[0].name).toBe("21s Bicep Curl");
  });

  it("still strips a genuine markdown numbered-list marker from an exercise name", () => {
    const parsed = parseActivityText("1. Squat | 1 | 10 | 60 | 8");
    expect(parsed.exercises[0].name).toBe("Squat");
  });

  it("reads เคเดนซ์เฉลี่ย (avgCadence) in Thai and English", () => {
    expect(parseActivityText("เคเดนซ์เฉลี่ย: 168").avgCadence).toBe(168);
    expect(parseActivityText("Cadence: 90").avgCadence).toBe(90);
  });

  it("reads a หมายเหตุ line as free-text notes", () => {
    const parsed = parseActivityText("หมายเหตุ: Training Effect 2.1 (ดี), VO2max 47");
    expect(parsed.notes).toBe("Training Effect 2.1 (ดี), VO2max 47");
  });

  it("also matches the English 'note'/'notes' keyword", () => {
    expect(parseActivityText("note: heart rate zone breakdown mostly aerobic").notes).toBe(
      "heart rate zone breakdown mostly aerobic"
    );
  });

  it("treats a bare '-' notes answer as no note (the prompt's own placeholder for 'not present')", () => {
    expect(parseActivityText("หมายเหตุ: -").notes).toBeNull();
  });

  it("leaves weightKg null for a set row whose weight column is the watch's own '--' placeholder", () => {
    // A watch that only counts reps via motion sensing (no load cell) marks
    // the weight column "--" rather than leaving it blank — same outcome as
    // an explicitly empty cell: firstNumber finds no digit in "--" either
    // way, so no special-casing was actually needed here.
    const parsed = parseActivityText("สควอทบาร์เบล | 1 | 10 | --");
    expect(parsed.exercises).toEqual([{ name: "สควอทบาร์เบล", notes: null, sets: [{ reps: 10, weightKg: null, rpe: null }] }]);
  });

  describe("best pace/speed (maxSpeedMs)", () => {
    it("converts an mm:ss run pace to m/s (per km)", () => {
      const parsed = parseActivityText("ประเภท: วิ่ง\nเพซที่ดีที่สุด: 5:30");
      expect(parsed.maxSpeedMs).toBeCloseTo(1000 / 330, 5); // 5:30 = 330s/km
    });

    it("converts an mm:ss swim pace to m/s (per 100m, not per km)", () => {
      const parsed = parseActivityText("ประเภท: ว่ายน้ำ\nเพซที่ดีที่สุด: 1:45");
      expect(parsed.maxSpeedMs).toBeCloseTo(100 / 105, 5); // 1:45 = 105s/100m
    });

    it("converts a plain km/h number for a non-pace type", () => {
      const parsed = parseActivityText("ประเภท: ปั่นจักรยาน\nความเร็วสูงสุด: 32.4");
      expect(parsed.maxSpeedMs).toBeCloseTo(32.4 / 3.6, 5);
    });

    it("also matches the English 'best pace'/'max speed' keywords", () => {
      expect(parseActivityText("ประเภท: วิ่ง\nBest Pace: 5:30").maxSpeedMs).toBeCloseTo(1000 / 330, 5);
      expect(parseActivityText("ประเภท: ปั่นจักรยาน\nMax Speed: 32.4").maxSpeedMs).toBeCloseTo(32.4 / 3.6, 5);
    });

    it("treats a bare '-' answer as no value", () => {
      expect(parseActivityText("ประเภท: วิ่ง\nเพซที่ดีที่สุด: -").maxSpeedMs).toBeNull();
    });

    it("resolves correctly even when the best-pace line appears before the type line", () => {
      // The raw text is held until the whole line loop finishes and
      // result.type is final, so line order within the pasted answer
      // shouldn't matter — the prompt just happens to ask for type first.
      const parsed = parseActivityText("เพซที่ดีที่สุด: 5:30\nประเภท: วิ่ง");
      expect(parsed.maxSpeedMs).toBeCloseTo(1000 / 330, 5);
    });

    it("skips a bare number given for a pace-based type instead of guessing a unit", () => {
      // A run/swim expects "mm:ss"; a plain number here is ambiguous (could
      // be misreading km/h onto a pace-based sport) so it's dropped rather
      // than silently stored as if it meant something.
      const parsed = parseActivityText("ประเภท: วิ่ง\nความเร็วสูงสุด: 25");
      expect(parsed.maxSpeedMs).toBeNull();
    });

    it("skips an mm:ss answer given for a non-pace type instead of guessing a unit", () => {
      const parsed = parseActivityText("ประเภท: ปั่นจักรยาน\nเพซที่ดีที่สุด: 5:30");
      expect(parsed.maxSpeedMs).toBeNull();
    });
  });
});
