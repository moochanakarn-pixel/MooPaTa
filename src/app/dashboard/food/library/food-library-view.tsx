"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GRAM_UNIT, isGramUnit, macrosForGrams, per100gFromTotal, referenceQuantity, referenceQuantityLabel } from "@/lib/food";

export interface LibraryFood {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  source: "CATALOG" | "BARCODE" | "LABEL" | "CUSTOM";
  logCount: number;
  isFavorite: boolean;
  typicalGrams: number;
  unitLabel: string;
}

const SOURCE_LABEL: Record<LibraryFood["source"], string> = {
  CATALOG: "แคตตาล็อก",
  BARCODE: "บาร์โค้ด",
  LABEL: "ฉลากอาหาร",
  CUSTOM: "พิมพ์เอง",
};

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

function EditForm({ food, onCancel, onSaved }: { food: LibraryFood; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(food.name);
  const [unitLabel, setUnitLabel] = useState(food.unitLabel);
  // Seeded from the food's own reference quantity (100g, or 1 of its unit)
  // rather than the raw per100g fields directly — for a unit-based food
  // that's the only way these numbers land on something a person actually
  // recognizes (e.g. "150 kcal ต่อ 1 ชิ้น" instead of "15000 kcal/100g").
  const initialRef = useMemo(() => macrosForGrams(food, referenceQuantity(food.unitLabel)), [food]);
  const [calories, setCalories] = useState(String(Math.round(initialRef.calories * 100) / 100));
  const [protein, setProtein] = useState(String(Math.round(initialRef.proteinG * 100) / 100));
  const [carb, setCarb] = useState(String(Math.round(initialRef.carbG * 100) / 100));
  const [fat, setFat] = useState(String(Math.round(initialRef.fatG * 100) / 100));
  const [typicalGrams, setTypicalGrams] = useState(String(food.typicalGrams));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUnitLabel = unitLabel.trim() || GRAM_UNIT;
  const refLabel = referenceQuantityLabel(trimmedUnitLabel);

  async function save() {
    // Number("") is 0, not NaN — an emptied field must fail this check
    // rather than silently save as a zero macro, so check the raw string
    // first.
    const rawFields = [calories, protein, carb, fat, typicalGrams];
    const caloriesRef = Number(calories);
    const proteinRef = Number(protein);
    const carbRef = Number(carb);
    const fatRef = Number(fat);
    const typicalGramsNum = Number(typicalGrams);
    if (
      !name.trim() ||
      rawFields.some((s) => s.trim() === "") ||
      [caloriesRef, proteinRef, carbRef, fatRef].some((n) => !Number.isFinite(n) || n < 0) ||
      !Number.isFinite(typicalGramsNum) ||
      typicalGramsNum <= 0
    ) {
      setError("กรอกข้อมูลให้ถูกต้องก่อน");
      return;
    }
    setError(null);
    setSaving(true);
    // Convert back from "per reference quantity" to the stored per-100
    // basis — the same total-at-a-given-portion-size math the custom-food
    // add form already uses, just running in reverse from the reference
    // quantity instead of forward from an arbitrary grams input.
    const per100g = per100gFromTotal(
      { calories: caloriesRef, proteinG: proteinRef, carbG: carbRef, fatG: fatRef },
      referenceQuantity(trimmedUnitLabel)
    );
    const res = await fetch(`/api/food/${food.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ...per100g,
        typicalGrams: typicalGramsNum,
        unitLabel: trimmedUnitLabel,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="ชื่อเมนู" />
      <div>
        <label className="mb-1 block text-[10px] text-neutral-500">
          หน่วยนับ — &quot;{GRAM_UNIT}&quot; ถ้าชั่งน้ำหนัก หรือพิมพ์หน่วยเอง เช่น ชิ้น, ที่, ถ้วย ถ้านับเป็นจำนวน
        </label>
        <input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} className={`${INPUT_CLASS} w-32`} placeholder={GRAM_UNIT} />
      </div>
      {!isGramUnit(trimmedUnitLabel) && (
        <p className="text-xs text-amber-400">
          เปลี่ยนหน่วยแล้วต้องกรอกค่าพลังงาน/แมโครใหม่ให้ตรงกับ &quot;{refLabel}&quot; ด้านล่างด้วย
        </p>
      )}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">kcal/{refLabel}</label>
          <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">โปรตีน/{refLabel}</label>
          <input type="number" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">คาร์บ/{refLabel}</label>
          <input type="number" min="0" value={carb} onChange={(e) => setCarb(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">ไขมัน/{refLabel}</label>
          <input type="number" min="0" value={fat} onChange={(e) => setFat(e.target.value)} className={INPUT_CLASS} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] text-neutral-500">
          ปริมาณที่กินปกติ ({trimmedUnitLabel}) — ใช้พรีฟิลตอนแนะนำเมนูนี้
        </label>
        <input
          type="number"
          min="0"
          value={typicalGrams}
          onChange={(e) => setTypicalGrams(e.target.value)}
          className={`${INPUT_CLASS} w-28`}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

export function FoodLibraryView({ foods }: { foods: LibraryFood[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, query]);

  async function confirmDelete(id: string) {
    setDeleteError(null);
    setDeleting(true);
    const res = await fetch(`/api/food/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setConfirmDeleteId(null);
      router.refresh();
    } else {
      setDeleteError("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  async function toggleFavorite(id: string, next: boolean) {
    setTogglingFavoriteId(id);
    const res = await fetch(`/api/food/${id}/favorite`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: next }),
    });
    setTogglingFavoriteId(null);
    if (res.ok) router.refresh();
  }

  if (foods.length === 0) {
    return <p className="py-12 text-center text-sm text-neutral-600">ยังไม่มีเมนูในคลัง — บันทึกอาหารสักครั้งแล้วจะมาโผล่ที่นี่</p>;
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาในคลังอาหาร..."
        className={`${INPUT_CLASS} mb-4`}
      />

      <ul className="space-y-2.5">
        {filtered.map((f) => (
          <li key={f.id} className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-5 py-4">
            {editingId === f.id ? (
              <EditForm
                food={f}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  router.refresh();
                }}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-200">
                    {f.name}
                    {f.isFavorite && (
                      <span title="เมนูโปรด — แนะนำที่หน้าบันทึกอาหาร" className="text-amber-400">
                        ★
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {(() => {
                      const ref = macrosForGrams(f, referenceQuantity(f.unitLabel));
                      return (
                        <>
                          {Math.round(ref.calories)} kcal · {ref.proteinG.toFixed(0)}p / {ref.carbG.toFixed(0)}c / {ref.fatG.toFixed(0)}f ต่อ{" "}
                          {referenceQuantityLabel(f.unitLabel)} · ปกติกิน {Math.round(f.typicalGrams)} {f.unitLabel}
                        </>
                      );
                    })()}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    {SOURCE_LABEL[f.source]} · บันทึกไปแล้ว {f.logCount} ครั้ง
                  </p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <button
                    onClick={() => toggleFavorite(f.id, !f.isFavorite)}
                    disabled={togglingFavoriteId === f.id}
                    title={f.isFavorite ? "เอาออกจากเมนูโปรด" : "ตั้งเป็นเมนูโปรด"}
                    className={`text-base transition disabled:opacity-50 ${f.isFavorite ? "text-amber-400 hover:text-amber-300" : "text-neutral-600 hover:text-amber-400"}`}
                  >
                    {f.isFavorite ? "★" : "☆"}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setDeleteError(null);
                      setEditingId(f.id);
                    }}
                    className="text-xs text-neutral-500 transition hover:text-neutral-200"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setDeleteError(null);
                      setConfirmDeleteId(f.id);
                    }}
                    className="text-xs text-neutral-500 transition hover:text-red-400"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            )}

            {confirmDeleteId === f.id && (
              <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 p-3">
                <p className="text-xs text-red-300">
                  {f.logCount > 0
                    ? `ลบ "${f.name}" จะลบประวัติการกินที่บันทึกด้วยเมนูนี้ทั้งหมด ${f.logCount} รายการไปด้วย — ยืนยันลบหรือไม่?`
                    : `ลบ "${f.name}" ออกจากคลัง?`}
                </p>
                {deleteError && <p className="mt-1 text-xs text-red-400">{deleteError}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => confirmDelete(f.id)}
                    disabled={deleting}
                    className="rounded-lg bg-red-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleting ? "กำลังลบ..." : "ยืนยันลบ"}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setDeleteError(null);
                    }}
                    className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
