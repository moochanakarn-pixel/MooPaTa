"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { macrosForGrams } from "@/lib/food";
import type { LibraryFood } from "./food-library-view";

export interface MealTemplateItemData {
  foodId: string;
  foodName: string;
  grams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
}

export interface MealTemplateData {
  id: string;
  name: string;
  items: MealTemplateItemData[];
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

function templateCalories(items: MealTemplateItemData[]): number {
  return items.reduce((sum, i) => sum + macrosForGrams(i, i.grams).calories, 0);
}

interface DraftRow {
  foodId: string;
  grams: string;
}

function CreateForm({ foods, onCancel, onSaved }: { foods: LibraryFood[]; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<DraftRow[]>(
    foods.length > 0 ? [{ foodId: foods[0].id, grams: String(foods[0].typicalGrams) }] : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    if (foods.length === 0) return;
    setRows((r) => [...r, { foodId: foods[0].id, grams: String(foods[0].typicalGrams) }]);
  }

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  async function save() {
    if (!name.trim()) {
      setError("ตั้งชื่อมื้อโปรดก่อน");
      return;
    }
    if (rows.length === 0) {
      setError("เพิ่มอาหารอย่างน้อย 1 อย่าง");
      return;
    }
    const items: { foodId: string; grams: number }[] = [];
    for (const row of rows) {
      const grams = Number(row.grams);
      if (!Number.isFinite(grams) || grams <= 0) {
        setError("ปริมาณต้องเป็นตัวเลขมากกว่า 0 ทุกแถว");
        return;
      }
      items.push({ foodId: row.foodId, grams });
    }
    setError(null);
    setSaving(true);
    const res = await fetch("/api/meal-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), items }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ชื่อมื้อโปรด เช่น มื้อเช้าปกติ"
        className={`${INPUT_CLASS} mb-3`}
      />
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={row.foodId}
              onChange={(e) => {
                const food = foods.find((f) => f.id === e.target.value);
                updateRow(i, { foodId: e.target.value, grams: food ? String(food.typicalGrams) : row.grams });
              }}
              className={`${INPUT_CLASS} flex-1`}
            >
              {foods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="any"
              value={row.grams}
              onChange={(e) => updateRow(i, { grams: e.target.value })}
              className={`${INPUT_CLASS} w-20`}
            />
            <button
              onClick={() => removeRow(i)}
              disabled={rows.length <= 1}
              className="flex-none rounded-lg border border-neutral-800 px-2 py-1.5 text-xs text-neutral-500 transition hover:text-rose-400 disabled:opacity-30"
            >
              ลบ
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRow} className="mt-3 text-xs text-neutral-500 transition hover:text-neutral-300">
        + เพิ่มอาหาร
      </button>
      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#fc4c02] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button onClick={onCancel} className="rounded-lg px-4 py-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

// "มื้อโปรด" (meal combo templates) — a named group of foods eaten together
// often (e.g. "มื้อเช้าปกติ"), saved once and logged in one tap from the
// diary's add-food panel instead of adding each item one at a time. Lives
// on the library page (not the diary) because creating one needs the full
// personal food list as a picker source, which this page already has —
// same reasoning as why nutrition value edits only happen here too.
export function MealTemplatesSection({ templates, foods }: { templates: MealTemplateData[]; foods: LibraryFood[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteTemplate(id: string) {
    if (!confirm("ลบมื้อโปรดนี้?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/meal-template/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-neutral-400">มื้อโปรด</h2>
      {templates.length > 0 && (
        <ul className="mb-3 space-y-2">
          {templates.map((tmpl) => (
            <li key={tmpl.id} className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200">{tmpl.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {tmpl.items.map((i) => `${i.foodName} ${Math.round(i.grams)}ก.`).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">{Math.round(templateCalories(tmpl.items))} kcal รวม</p>
                </div>
                <button
                  onClick={() => deleteTemplate(tmpl.id)}
                  disabled={deletingId === tmpl.id}
                  className="flex-none text-xs text-neutral-500 transition hover:text-rose-400 disabled:opacity-50"
                >
                  ลบ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <CreateForm
          foods={foods}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : foods.length > 0 ? (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-xl border border-dashed border-neutral-800 px-4 py-3 text-sm text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
        >
          + สร้างมื้อโปรด
        </button>
      ) : (
        <p className="text-xs text-neutral-600">เพิ่มอาหารในคลังก่อนถึงจะสร้างมื้อโปรดได้</p>
      )}
    </div>
  );
}
