"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface LibraryFood {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  source: "CATALOG" | "BARCODE" | "CUSTOM";
  logCount: number;
}

const SOURCE_LABEL: Record<LibraryFood["source"], string> = {
  CATALOG: "แคตตาล็อก",
  BARCODE: "บาร์โค้ด",
  CUSTOM: "พิมพ์เอง",
};

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

function EditForm({ food, onCancel, onSaved }: { food: LibraryFood; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(food.name);
  const [calories, setCalories] = useState(String(food.caloriesPer100g));
  const [protein, setProtein] = useState(String(food.proteinPer100g));
  const [carb, setCarb] = useState(String(food.carbPer100g));
  const [fat, setFat] = useState(String(food.fatPer100g));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const caloriesPer100g = Number(calories);
    const proteinPer100g = Number(protein);
    const carbPer100g = Number(carb);
    const fatPer100g = Number(fat);
    if (!name.trim() || [caloriesPer100g, proteinPer100g, carbPer100g, fatPer100g].some((n) => !Number.isFinite(n) || n < 0)) {
      setError("กรอกข้อมูลให้ถูกต้องก่อน");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/food/${food.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), caloriesPer100g, proteinPer100g, carbPer100g, fatPer100g }),
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
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">kcal/100g</label>
          <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">โปรตีน/100g</label>
          <input type="number" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">คาร์บ/100g</label>
          <input type="number" min="0" value={carb} onChange={(e) => setCarb(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-neutral-500">ไขมัน/100g</label>
          <input type="number" min="0" value={fat} onChange={(e) => setFat(e.target.value)} className={INPUT_CLASS} />
        </div>
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
                  <p className="truncate text-sm font-medium text-neutral-200">{f.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {Math.round(f.caloriesPer100g)} kcal · {f.proteinPer100g.toFixed(0)}p / {f.carbPer100g.toFixed(0)}c /{" "}
                    {f.fatPer100g.toFixed(0)}f ต่อ 100 ก.
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    {SOURCE_LABEL[f.source]} · บันทึกไปแล้ว {f.logCount} ครั้ง
                  </p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <button onClick={() => setEditingId(f.id)} className="text-xs text-neutral-500 transition hover:text-neutral-200">
                    แก้ไข
                  </button>
                  <button onClick={() => setConfirmDeleteId(f.id)} className="text-xs text-neutral-500 transition hover:text-red-400">
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
                    onClick={() => setConfirmDeleteId(null)}
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
