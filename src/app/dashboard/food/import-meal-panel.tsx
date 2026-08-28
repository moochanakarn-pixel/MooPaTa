"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MEAL_TYPE_LABEL } from "@/lib/food";
import { parseMealText, type ParsedFoodRow } from "@/lib/meal-import-parse";

const MEAL_TYPE_OPTIONS = ["", "BREAKFAST", "LUNCH", "DINNER", "SNACK"].map((value) => ({
  value,
  label: MEAL_TYPE_LABEL[value],
}));

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

const PLACEHOLDER = `วางตารางที่ AI คำนวณให้มาตรงนี้ เช่น:

ข้าวสวย  235 ก.  300 kcal  4.5 ก.  65 ก.  0.7 ก.
กระเพราเนื้อสับ  135 ก.  230 kcal  20 ก.  6.5 ก.  15 ก.

ดื่มน้ำ 550 มล.`;

// A row the user is reviewing before it gets saved — same shape as a
// parsed row, but with fields as editable strings and a keep/remove flag,
// since the parser is a heuristic over free-form pasted text and will
// occasionally misread a line.
interface EditableRow extends Omit<ParsedFoodRow, "grams" | "calories" | "proteinG" | "carbG" | "fatG"> {
  id: number;
  grams: string;
  calories: string;
  proteinG: string;
  carbG: string;
  fatG: string;
  keep: boolean;
}

function toEditable(rows: ParsedFoodRow[]): EditableRow[] {
  return rows.map((r, i) => ({
    id: i,
    name: r.name,
    grams: String(r.grams),
    calories: String(Math.round(r.calories)),
    proteinG: String(Math.round(r.proteinG)),
    carbG: String(Math.round(r.carbG)),
    fatG: String(Math.round(r.fatG)),
    keep: true,
  }));
}

// Lets the user paste a nutrition breakdown they got from an AI chat
// (Claude, ChatGPT, etc. — the "how many calories is this meal" table
// people already do manually before typing everything into the search box
// one dish at a time) and log the whole meal in one go. The parse is shown
// back as an editable, individually-removable preview rather than saved
// straight away — free-form text parsing will sometimes get a row wrong,
// and this is the safety net for that.
export function ImportMealPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [waterMl, setWaterMl] = useState("");
  const [mealType, setMealType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parse() {
    const result = parseMealText(text);
    setRows(toEditable(result.items));
    setWaterMl(result.waterMl !== null ? String(result.waterMl) : "");
    setError(
      result.items.length === 0
        ? "อ่านตารางไม่ออก ลองวางใหม่ หรือดูว่ารูปแบบตรงกับตัวอย่างมั้ย"
        : null
    );
  }

  function updateRow(id: number, patch: Partial<EditableRow>) {
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
  }

  async function saveAll() {
    if (!rows) return;
    const kept = rows.filter((r) => r.keep);
    const water = Number(waterMl);
    if (kept.length === 0 && !(Number.isFinite(water) && water > 0)) {
      setError("ไม่มีรายการให้บันทึก");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      for (const r of kept) {
        const grams = Number(r.grams);
        const calories = Number(r.calories);
        const proteinG = Number(r.proteinG);
        const carbG = Number(r.carbG);
        const fatG = Number(r.fatG);
        if (!r.name.trim() || !Number.isFinite(grams) || grams <= 0) {
          throw new Error(`invalid_row:${r.name || "(ไม่มีชื่อ)"}`);
        }
        const ratio = 100 / grams;
        const res = await fetch("/api/food/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grams,
            mealType: mealType || null,
            food: {
              name: r.name.trim(),
              caloriesPer100g: (Number.isFinite(calories) ? calories : 0) * ratio,
              proteinPer100g: (Number.isFinite(proteinG) ? proteinG : 0) * ratio,
              carbPer100g: (Number.isFinite(carbG) ? carbG : 0) * ratio,
              fatPer100g: (Number.isFinite(fatG) ? fatG : 0) * ratio,
              source: "CUSTOM",
            },
          }),
        });
        if (!res.ok) throw new Error("save_failed");
      }
      if (Number.isFinite(water) && water > 0) {
        const res = await fetch("/api/water/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ml: Math.round(water) }),
        });
        if (!res.ok) throw new Error("save_failed");
      }
      router.refresh();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.startsWith("invalid_row:") ? `ข้อมูลของ "${msg.split(":")[1]}" ไม่ครบ แก้ก่อนบันทึก` : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">นำเข้าจาก AI</h3>
        <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
          ปิด
        </button>
      </div>

      {!rows ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={8}
            className={`${INPUT_CLASS} resize-y font-mono text-xs`}
          />
          <p className="mt-2 text-xs text-neutral-600">
            วางตารางแคลอรี่/แมโครที่ AI คำนวณให้ (เช่นจาก Claude, ChatGPT) — ต้องมีชื่อเมนู ปริมาณ kcal โปรตีน คาร์บ ต่อบรรทัด
          </p>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            onClick={parse}
            disabled={!text.trim()}
            className="mt-3 rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
          >
            แปลงข้อมูล
          </button>
        </>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-neutral-500">ไม่พบรายการอาหารในข้อความนี้</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className={`rounded-lg border border-neutral-800 p-3 ${!r.keep ? "opacity-40" : ""}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={r.keep}
                      onChange={(e) => updateRow(r.id, { keep: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      disabled={!r.keep}
                      className={`${INPUT_CLASS} flex-1 disabled:opacity-50`}
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 pl-6">
                    {(
                      [
                        ["grams", "กรัม"],
                        ["calories", "kcal"],
                        ["proteinG", "โปรตีน"],
                        ["carbG", "คาร์บ"],
                        ["fatG", "ไขมัน"],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <input
                          type="number"
                          min="0"
                          value={r[field]}
                          onChange={(e) => updateRow(r.id, { [field]: e.target.value })}
                          disabled={!r.keep}
                          className={`${INPUT_CLASS} disabled:opacity-50`}
                        />
                        <p className="mt-0.5 text-center text-[10px] text-neutral-600">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 border-t border-neutral-800 pt-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">มื้อ</label>
              <select value={mealType} onChange={(e) => setMealType(e.target.value)} className={`${INPUT_CLASS} w-32`}>
                {MEAL_TYPE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">น้ำ (มล.)</label>
              <input
                type="number"
                min="0"
                value={waterMl}
                onChange={(e) => setWaterMl(e.target.value)}
                placeholder="ไม่มี"
                className={`${INPUT_CLASS} w-24`}
              />
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={saveAll}
              disabled={saving}
              className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
            </button>
            <button
              onClick={() => setRows(null)}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"
            >
              วางข้อความใหม่
            </button>
          </div>
        </>
      )}
    </div>
  );
}
