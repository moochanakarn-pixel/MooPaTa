"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  // Deep link from the diary's inline edit form ("แก้ไขค่าพลังงาน... ที่คลังอาหารส่วนตัว")
  // — jumps straight into editing that food instead of making the user
  // search for it themselves.
  const [editingId, setEditingId] = useState<string | null>(() => searchParams.get("edit"));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [showConflictDetails, setShowConflictDetails] = useState(false);
  const editingItemRef = useRef<HTMLLIElement | null>(null);

  // Foods sharing the exact same name (case-insensitive) — new entries
  // can't create these anymore (see POST /api/food/log's reuse check), but
  // rows from before that existed, or from anything that wrote to the DB
  // directly, still can. Grouped here just to show the "รวมเมนูซ้ำ" banner;
  // the merge itself is done server-side against the user's full food list,
  // not this possibly search-filtered one.
  //
  // Same-named foods only merge safely if their macro values also match —
  // the server (see /api/food/merge-duplicates) refuses to merge ones that
  // don't, since every log always computes its macros live from whichever
  // Food row it points at, and repointing it at a row with different
  // per-100 values would silently change what that log has always shown.
  // Split the same way here so the banner tells the user which groups will
  // actually merge and which need manual review instead.
  const { mergeableGroups, conflictGroups } = useMemo(() => {
    const byName = new Map<string, LibraryFood[]>();
    for (const f of foods) {
      const key = f.name.trim().toLowerCase();
      const group = byName.get(key);
      if (group) group.push(f);
      else byName.set(key, [f]);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const macroKey = (f: LibraryFood) => [f.unitLabel, round(f.caloriesPer100g), round(f.proteinPer100g), round(f.carbPer100g), round(f.fatPer100g)].join("|");

    const mergeable: LibraryFood[][] = [];
    const conflicts: LibraryFood[][] = [];
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      const macroKeys = new Set(group.map(macroKey));
      if (macroKeys.size === 1) mergeable.push(group);
      else conflicts.push(group);
    }
    return { mergeableGroups: mergeable, conflictGroups: conflicts };
  }, [foods]);

  async function mergeDuplicates() {
    setMergeError(null);
    setMerging(true);
    const res = await fetch("/api/food/merge-duplicates", { method: "POST" });
    setMerging(false);
    if (res.ok) {
      router.refresh();
    } else {
      setMergeError("รวมเมนูซ้ำไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  useEffect(() => {
    if (editingId) editingItemRef.current?.scrollIntoView({ block: "center" });
    // Only meant to run once, right after landing here via the deep link —
    // not on every later editingId change from clicking แก้ไข manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // A deep link from an old diary entry can point at a food that has since
  // been soft-deleted from the library (deletedAt set) — the library page
  // only ever passes non-deleted foods in, so editingId here would silently
  // match nothing and the link would look like it did nothing. Say why.
  const editingTargetMissing = editingId !== null && !foods.some((f) => f.id === editingId);

  return (
    <div>
      {editingTargetMissing && (
        <p className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-xs text-neutral-400">
          เมนูที่จะแก้ไขถูกลบออกจากคลังไปแล้ว จึงแก้ไขไม่ได้ — ประวัติการกินเดิมยังอยู่เหมือนเดิม
        </p>
      )}

      {mergeableGroups.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
          <p className="text-sm font-medium text-amber-400">
            พบเมนูชื่อซ้ำกัน {mergeableGroups.length} กลุ่ม ({mergeableGroups.reduce((s, g) => s + g.length, 0)} รายการ):{" "}
            {mergeableGroups.map((g) => `${g[0].name} (×${g.length})`).join(", ")}
          </p>
          <p className="mt-1 text-xs text-amber-400/80">
            กดรวมแล้วแต่ละกลุ่มจะเหลือรายการเดียว (เก็บอันที่บันทึกไปแล้วเยอะสุดไว้) — ประวัติการกินทั้งหมดยังอยู่ครบ
            แค่ชี้ไปที่เมนูเดียวกันแทน
          </p>
          {mergeError && <p className="mt-1 text-xs text-red-400">{mergeError}</p>}
          <button
            onClick={mergeDuplicates}
            disabled={merging}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:opacity-50"
          >
            {merging ? "กำลังรวม..." : "รวมเมนูซ้ำทั้งหมด"}
          </button>
        </div>
      )}

      {conflictGroups.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-800/60 bg-rose-950/20 p-4">
          <p className="text-sm font-medium text-rose-400">
            พบเมนูชื่อซ้ำกัน {conflictGroups.length} กลุ่ม แต่ค่าโภชนาการไม่ตรงกัน — ไม่รวมให้อัตโนมัติ:{" "}
            {conflictGroups.map((g) => g[0].name).join(", ")}
          </p>
          <p className="mt-1 text-xs text-rose-400/80">
            เพราะประวัติที่เคยบันทึกไว้จะเปลี่ยนค่าไปตามเมนูที่เหลือทันที — เลื่อนลงไปหาเมนูพวกนี้ในรายการด้านล่าง
            แล้วแก้ไขให้ค่าตรงกันก่อนถึงจะรวมอีกครั้งได้ หรือถ้าจริงๆ เป็นคนละเมนู ลองเปลี่ยนชื่อให้ต่างกันแทน
          </p>
          <button
            onClick={() => setShowConflictDetails((v) => !v)}
            className="mt-2 text-xs font-medium text-rose-400 underline underline-offset-2"
          >
            {showConflictDetails ? "ซ่อนรายละเอียด" : "ดูรายละเอียดแต่ละเมนู"}
          </button>
          {showConflictDetails && (
            <ul className="mt-2 space-y-2">
              {conflictGroups.map((group) => (
                <li key={group[0].name} className="rounded-lg bg-rose-950/30 p-2.5 text-xs">
                  <p className="mb-1 font-medium text-rose-400">{group[0].name}</p>
                  <ul className="space-y-0.5">
                    {group.map((f) => {
                      const ref = macrosForGrams(f, referenceQuantity(f.unitLabel));
                      return (
                        <li key={f.id} className="text-rose-400/80">
                          {Math.round(ref.calories)} kcal · {ref.proteinG.toFixed(0)}p / {ref.carbG.toFixed(0)}c / {ref.fatG.toFixed(0)}f ต่อ{" "}
                          {referenceQuantityLabel(f.unitLabel)} · บันทึกไปแล้ว {f.logCount} ครั้ง
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาในคลังอาหาร..."
        className={`${INPUT_CLASS} mb-4`}
      />

      <ul className="space-y-2.5">
        {filtered.map((f) => (
          <li
            key={f.id}
            ref={editingId === f.id ? editingItemRef : undefined}
            className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-5 py-4"
          >
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
                      <span title="เมนูโปรด" className="text-amber-400">
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
              <div className="mt-3 rounded-lg border border-neutral-700 bg-neutral-900/60 p-3">
                <p className="text-xs text-neutral-300">
                  {f.logCount > 0
                    ? `ลบ "${f.name}" ออกจากคลัง? ประวัติการกิน ${f.logCount} รายการที่เคยบันทึกไว้จะยังอยู่เหมือนเดิม — จะแค่ไม่มาโผล่แนะนำหรือค้นเจอในคลังอีก`
                    : `ลบ "${f.name}" ออกจากคลัง?`}
                </p>
                {deleteError && <p className="mt-1 text-xs text-red-400">{deleteError}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => confirmDelete(f.id)}
                    disabled={deleting}
                    className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
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
