"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { macrosForGrams, MEAL_TYPE_LABEL, per100gFromTotal, type Per100g } from "@/lib/food";
import { THAI_FOOD_CATALOG, type CatalogFood } from "@/lib/thai-food-catalog";
import { BarcodeScanner } from "./barcode-scanner";
import { ImportMealPanel } from "./import-meal-panel";

export interface PersonalFood extends Per100g {
  id: string;
  name: string;
}

export interface TodayLogEntry {
  id: string;
  foodName: string;
  grams: number;
  mealType: string | null;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface DailyTargets {
  targetCalories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

type PendingFood =
  | { kind: "personal"; food: PersonalFood; grams: number }
  | { kind: "catalog"; food: CatalogFood; grams: number }
  | { kind: "barcode"; name: string; per100g: Per100g; barcode: string; grams: number }
  | { kind: "custom"; grams: number };

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

const MEAL_TYPE_OPTIONS = ["", "BREAKFAST", "LUNCH", "DINNER", "SNACK"].map((value) => ({
  value,
  label: MEAL_TYPE_LABEL[value],
}));
const MEAL_GROUP_ORDER = ["BREAKFAST", "LUNCH", "DINNER", "SNACK", ""] as const;

// A reasonable starting guess so most people don't have to touch the meal
// selector at all — still just a default, freely overridable.
function guessMealType(): string {
  const h = new Date().getHours();
  if (h < 11) return "BREAKFAST";
  if (h < 15) return "LUNCH";
  if (h < 21) return "DINNER";
  return "SNACK";
}

function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-3 py-2 text-center">
      <p className="text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] text-neutral-500">{label}</p>
    </div>
  );
}

function ProgressBar({ eaten, target, color }: { eaten: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((eaten / target) * 100, 100) : 0;
  const over = target > 0 && eaten > target;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "#ef4444" : color }} />
    </div>
  );
}

export function FoodLogView({
  todayLogs,
  personalFoods,
  targets,
}: {
  todayLogs: TodayLogEntry[];
  personalFoods: PersonalFood[];
  targets: DailyTargets | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pending, setPending] = useState<PendingFood | null>(null);
  const [customName, setCustomName] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarb, setCustomCarb] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Starts unset (matches what the server renders) and is filled in by the
  // effect below right after mount — computing the time-of-day guess in the
  // initializer would run it once during SSR and again on the client, and
  // if those two clocks disagree (e.g. a UTC server, a Thailand visitor)
  // the <select>'s initial value mismatches between server and client HTML.
  const [mealType, setMealType] = useState("");
  useEffect(() => {
    setMealType(guessMealType());
  }, []);

  const totals = useMemo(
    () =>
      todayLogs.reduce(
        (acc, l) => ({
          calories: acc.calories + l.calories,
          proteinG: acc.proteinG + l.proteinG,
          carbG: acc.carbG + l.carbG,
          fatG: acc.fatG + l.fatG,
        }),
        { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
      ),
    [todayLogs]
  );

  const mealGroups = useMemo(() => {
    const byKey = new Map<string, TodayLogEntry[]>();
    for (const l of todayLogs) {
      const key = l.mealType ?? "";
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(l);
    }
    return MEAL_GROUP_ORDER.filter((key) => byKey.has(key)).map((key) => {
      const entries = byKey.get(key)!;
      return { key, entries, calories: entries.reduce((sum, l) => sum + l.calories, 0) };
    });
  }, [todayLogs]);

  // Once the user has started typing custom macros, the portion they typed
  // them for must stay fixed — editing grams afterward would silently
  // rescale the per-100g values stored for reuse without changing what was
  // actually typed, corrupting the food's nutrition density permanently.
  const customMacrosStarted =
    pending?.kind === "custom" && (customCalories !== "" || customProtein !== "" || customCarb !== "" || customFat !== "");

  const personalMatches = query.trim()
    ? personalFoods.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];
  const catalogMatches = query.trim()
    ? THAI_FOOD_CATALOG.filter((f) => f.name.includes(query.trim())).slice(0, 8)
    : [];

  // How much room is left today, at typical serving sizes — the basis for
  // the "แนะนำมื้อถัดไป" suggestions below. Ranked by protein density since
  // that's usually the harder macro to hit, once there's still calorie
  // headroom to spend. Memoized like totals/mealGroups above so typing in
  // the search box or editing custom-macro fields doesn't re-sort the
  // catalog on every keystroke.
  const remainingCalories = targets ? targets.targetCalories - totals.calories : null;
  const suggestions = useMemo(() => {
    if (remainingCalories === null || remainingCalories <= 0) return [];
    return THAI_FOOD_CATALOG.map((f) => ({ food: f, ...macrosForGrams(f, f.typicalGrams) }))
      .filter((s) => s.calories <= remainingCalories)
      .sort((a, b) => b.proteinG - a.proteinG)
      .slice(0, 6);
  }, [remainingCalories]);

  function pickPersonal(food: PersonalFood) {
    setShowAdd(true);
    setPending({ kind: "personal", food, grams: 100 });
  }
  function pickCatalog(food: CatalogFood) {
    setShowAdd(true);
    setPending({ kind: "catalog", food, grams: food.typicalGrams });
  }
  function startCustom() {
    setCustomName(query.trim());
    setCustomCalories("");
    setCustomProtein("");
    setCustomCarb("");
    setCustomFat("");
    setPending({ kind: "custom", grams: 100 });
  }

  async function handleBarcodeDetect(code: string) {
    setShowScanner(false);
    setBarcodeError(null);
    const res = await fetch(`/api/food/barcode/${code}`);
    if (!res.ok) {
      setBarcodeError("ไม่พบข้อมูลสินค้านี้ในฐานข้อมูล — เพิ่มเองแทนได้");
      return;
    }
    const data = await res.json();
    setPending({
      kind: "barcode",
      name: data.name,
      per100g: {
        caloriesPer100g: data.caloriesPer100g,
        proteinPer100g: data.proteinPer100g,
        carbPer100g: data.carbPer100g,
        fatPer100g: data.fatPer100g,
      },
      barcode: data.barcode,
      grams: data.suggestedGrams ?? 100,
    });
  }

  async function submitPending() {
    if (!pending) return;
    if (!Number.isFinite(pending.grams) || pending.grams <= 0) {
      setSubmitError("กรอกปริมาณ (กรัม) ให้ถูกต้องก่อนบันทึก");
      return;
    }
    setSubmitError(null);
    setSaving(true);
    let body: Record<string, unknown>;

    if (pending.kind === "personal") {
      body = { foodId: pending.food.id, grams: pending.grams };
    } else if (pending.kind === "catalog") {
      body = {
        food: {
          name: pending.food.name,
          caloriesPer100g: pending.food.caloriesPer100g,
          proteinPer100g: pending.food.proteinPer100g,
          carbPer100g: pending.food.carbPer100g,
          fatPer100g: pending.food.fatPer100g,
          source: "CATALOG",
        },
        grams: pending.grams,
      };
    } else if (pending.kind === "barcode") {
      body = {
        food: { name: pending.name, ...pending.per100g, source: "BARCODE", barcode: pending.barcode },
        grams: pending.grams,
      };
    } else {
      const grams = pending.grams;
      const per100g = per100gFromTotal(
        {
          calories: Number(customCalories) || 0,
          proteinG: Number(customProtein) || 0,
          carbG: Number(customCarb) || 0,
          fatG: Number(customFat) || 0,
        },
        grams
      );
      body = { food: { name: customName.trim(), ...per100g, source: "CUSTOM" }, grams };
    }
    body.mealType = mealType || null;

    const res = await fetch("/api/food/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setPending(null);
      setShowAdd(false);
      setQuery("");
      router.refresh();
    } else {
      setSubmitError("บันทึกไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง");
    }
  }

  async function deleteLog(id: string) {
    setDeleteError(null);
    const res = await fetch(`/api/food/log/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setDeleteError("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <p className="text-xs text-neutral-500">กินไปวันนี้</p>
        <p className="mb-3 text-3xl font-extrabold tracking-tight">
          {Math.round(totals.calories).toLocaleString("th-TH")}
          {targets && <span className="text-lg font-medium text-neutral-500"> / {targets.targetCalories.toLocaleString("th-TH")} kcal</span>}
          {!targets && <span className="text-lg font-medium text-neutral-500"> kcal</span>}
        </p>
        {targets && <ProgressBar eaten={totals.calories} target={targets.targetCalories} color="#fc4c02" />}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div>
            <MacroChip label="โปรตีน" value={`${Math.round(totals.proteinG)} ก.`} color="#38bdf8" />
            {targets && <div className="mt-1.5"><ProgressBar eaten={totals.proteinG} target={targets.proteinG} color="#38bdf8" /></div>}
          </div>
          <div>
            <MacroChip label="คาร์บ" value={`${Math.round(totals.carbG)} ก.`} color="#f59e0b" />
            {targets && <div className="mt-1.5"><ProgressBar eaten={totals.carbG} target={targets.carbG} color="#f59e0b" /></div>}
          </div>
          <div>
            <MacroChip label="ไขมัน" value={`${Math.round(totals.fatG)} ก.`} color="#f43f5e" />
            {targets && <div className="mt-1.5"><ProgressBar eaten={totals.fatG} target={targets.fatG} color="#f43f5e" /></div>}
          </div>
        </div>
      </div>

      {suggestions.length > 0 && !showAdd && (
        <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">แนะนำมื้อถัดไป</h2>
            <span className="text-xs text-neutral-500">เหลือ {Math.round(remainingCalories ?? 0)} kcal วันนี้</span>
          </div>
          <div className="space-y-1.5">
            {suggestions.map((s) => (
              <button
                key={s.food.name}
                onClick={() => pickCatalog(s.food)}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-800/60 px-3 py-2 text-left text-sm transition hover:border-neutral-700 hover:bg-neutral-800/40"
              >
                <span className="text-neutral-200">{s.food.name}</span>
                <span className="text-xs text-neutral-500">
                  {Math.round(s.calories)} kcal · โปรตีน {Math.round(s.proteinG)} ก.
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showImport && <ImportMealPanel onClose={() => setShowImport(false)} />}

      {!showAdd && !showImport ? (
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#fc4c02] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#e04402]"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            เพิ่มอาหาร
          </button>
          <button
            onClick={() => setShowImport(true)}
            title="วางตารางแคลอรี่ที่ได้จาก AI แล้วนำเข้าทั้งมื้อ"
            className="flex flex-none items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800/50"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path
                d="M10 3v8m0 0 3-3m-3 3-3-3M4 14v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            นำเข้าจาก AI
          </button>
        </div>
      ) : showAdd ? (
        <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4">
          {pending ? (
            <div>
              <h3 className="mb-3 text-sm font-medium text-neutral-300">
                {pending.kind === "personal" && pending.food.name}
                {pending.kind === "catalog" && pending.food.name}
                {pending.kind === "barcode" && pending.name}
                {pending.kind === "custom" && "เพิ่มเมนูเอง"}
              </h3>

              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs text-neutral-500">ปริมาณ (กรัม)</label>
                <input
                  type="number"
                  min="1"
                  value={pending.grams}
                  disabled={customMacrosStarted}
                  onChange={(e) => setPending({ ...pending, grams: Number(e.target.value) } as PendingFood)}
                  className={`${INPUT_CLASS} w-24 disabled:opacity-50`}
                />
                {customMacrosStarted && (
                  <span className="text-xs text-neutral-600">
                    (ล็อกไว้ — แคลอรี่/แมโครที่กรอกด้านล่างคำนวณจากปริมาณนี้)
                  </span>
                )}
              </div>

              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs text-neutral-500">มื้อ</label>
                <select value={mealType} onChange={(e) => setMealType(e.target.value)} className={`${INPUT_CLASS} w-36`}>
                  {MEAL_TYPE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {pending.kind === "custom" && (
                <div className="mb-3 space-y-2">
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="ชื่ออาหาร"
                    className={INPUT_CLASS}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                      placeholder="แคลอรี่ (kcal)"
                      className={INPUT_CLASS}
                    />
                    <input
                      type="number"
                      min="0"
                      value={customProtein}
                      onChange={(e) => setCustomProtein(e.target.value)}
                      placeholder="โปรตีน (ก.)"
                      className={INPUT_CLASS}
                    />
                    <input
                      type="number"
                      min="0"
                      value={customCarb}
                      onChange={(e) => setCustomCarb(e.target.value)}
                      placeholder="คาร์บ (ก.)"
                      className={INPUT_CLASS}
                    />
                    <input
                      type="number"
                      min="0"
                      value={customFat}
                      onChange={(e) => setCustomFat(e.target.value)}
                      placeholder="ไขมัน (ก.)"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">กรอกแคลอรี่/แมโครสำหรับปริมาณ {pending.grams || 0} กรัมด้านบน</p>
                </div>
              )}

              {pending.kind !== "custom" && (
                <p className="mb-3 text-xs text-neutral-500">
                  {(() => {
                    const per100g =
                      pending.kind === "personal" ? pending.food : pending.kind === "catalog" ? pending.food : pending.per100g;
                    const m = macrosForGrams(per100g, pending.grams);
                    return `${Math.round(m.calories)} kcal · โปรตีน ${Math.round(m.proteinG)} ก. · คาร์บ ${Math.round(m.carbG)} ก. · ไขมัน ${Math.round(m.fatG)} ก.`;
                  })()}
                </p>
              )}

              {submitError && <p className="mb-3 text-xs text-red-400">{submitError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={submitPending}
                  disabled={saving || (pending.kind === "custom" && !customName.trim())}
                  className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  onClick={() => {
                    setPending(null);
                    setSubmitError(null);
                  }}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"
                >
                  ย้อนกลับ
                </button>
              </div>
            </div>
          ) : showScanner ? (
            <BarcodeScanner onDetect={handleBarcodeDetect} onClose={() => setShowScanner(false)} />
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-300">เพิ่มอาหาร</h3>
                <button onClick={() => setShowAdd(false)} className="text-xs text-neutral-500 hover:text-neutral-300">
                  ปิด
                </button>
              </div>
              <div className="mb-2 flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาเมนู เช่น ผัดกะเพรา"
                  className={INPUT_CLASS}
                  autoFocus
                />
                <button
                  onClick={() => {
                    setBarcodeError(null);
                    setShowScanner(true);
                  }}
                  className="flex flex-none items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-600"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                    <path
                      d="M3 6V4h3M17 6V4h-3M3 14v2h3M17 14v2h-3M6 6v8M9 6v8M12 6v8M15 6v8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  สแกน
                </button>
              </div>
              {barcodeError && <p className="mb-2 text-xs text-red-400">{barcodeError}</p>}

              {query.trim() && (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {personalMatches.length > 0 && (
                    <>
                      <p className="px-1 pt-1 text-[11px] text-neutral-600">เมนูที่กินบ่อย</p>
                      {personalMatches.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => pickPersonal(f)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-neutral-800/50"
                        >
                          <span className="text-neutral-200">{f.name}</span>
                          <span className="text-xs text-neutral-500">{Math.round(f.caloriesPer100g)} kcal/100ก.</span>
                        </button>
                      ))}
                    </>
                  )}
                  {catalogMatches.length > 0 && (
                    <>
                      <p className="px-1 pt-1 text-[11px] text-neutral-600">แนะนำจากรายการอาหารไทย</p>
                      {catalogMatches.map((f) => (
                        <button
                          key={f.name}
                          onClick={() => pickCatalog(f)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-neutral-800/50"
                        >
                          <span className="text-neutral-200">{f.name}</span>
                          <span className="text-xs text-neutral-500">{Math.round(f.caloriesPer100g)} kcal/100ก.</span>
                        </button>
                      ))}
                    </>
                  )}
                  <button
                    onClick={startCustom}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm text-[#fc4c02] hover:bg-neutral-800/50"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    เพิ่ม &quot;{query.trim()}&quot; เอง
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {deleteError && <p className="mb-2 text-xs text-red-400">{deleteError}</p>}

      {todayLogs.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-600">ยังไม่ได้บันทึกอาหารวันนี้</p>
      ) : (
        <div className="space-y-5">
          {mealGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 className="text-sm font-medium text-neutral-400">{MEAL_TYPE_LABEL[group.key]}</h3>
                <span className="text-xs text-neutral-600">{Math.round(group.calories)} kcal</span>
              </div>
              <ul className="space-y-2.5">
                {group.entries.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-200">{l.foodName}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {Math.round(l.grams)} ก. · {Math.round(l.calories)} kcal
                      </p>
                    </div>
                    <button onClick={() => deleteLog(l.id)} className="flex-none text-neutral-600 hover:text-red-400" title="ลบ">
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
