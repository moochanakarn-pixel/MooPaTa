"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GENERIC_UNIT,
  GRAM_UNIT,
  isGramUnit,
  macrosForGrams,
  MEAL_TYPE_LABEL,
  per100gFromTotal,
  referenceQuantity,
  referenceQuantityLabel,
  type Per100g,
} from "@/lib/food";
import { THAI_FOOD_CATALOG, type CatalogFood } from "@/lib/thai-food-catalog";
import { DAILY_CHOLESTEROL_LIMIT_MG, matchesPurineKeyword } from "@/lib/health-flags";
import { FoodLabelScanner, type FoodLabelResult } from "./food-label-scanner";
import { ImportMealPanel } from "./import-meal-panel";
import { NutrientOverview, type CustomPage, type NutrientPage } from "./nutrient-overview";

export interface PersonalFood extends Per100g {
  id: string;
  name: string;
  typicalGrams: number;
  unitLabel: string;
  // How many times this food has actually been logged, all-time — drives
  // the "เมนูที่กินบ่อย" quick-pick list in the add-food panel.
  logCount: number;
}

export interface TodayLogEntry {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  mealType: string | null;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  sugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  fiberG: number | null;
  unitLabel: string;
}

export interface DailyTargets {
  targetCalories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  // How much of proteinG/carbG above is from today's logged activity (see
  // applyActivityBonus in src/lib/nutrition.ts) — shown as a note so the
  // bump isn't invisible, just a bigger number with no explanation.
  carbBonusG: number;
  proteinBonusG: number;
}

export interface HealthFlags {
  highCholesterol: boolean;
  highUricAcid: boolean;
}

type PendingFood =
  | { kind: "personal"; food: PersonalFood; grams: number }
  | { kind: "catalog"; food: CatalogFood; grams: number }
  | { kind: "label"; name: string; per100g: Per100g; grams: number }
  | { kind: "custom"; grams: number };

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

const MEAL_TYPE_OPTIONS = ["", "BREAKFAST", "LUNCH", "DINNER", "SNACK"].map((value) => ({
  value,
  label: MEAL_TYPE_LABEL[value],
}));

// A reasonable starting guess so most people don't have to touch the meal
// selector at all — still just a default, freely overridable.
function guessMealType(): string {
  const h = new Date().getHours();
  if (h < 11) return "BREAKFAST";
  if (h < 15) return "LUNCH";
  if (h < 21) return "DINNER";
  return "SNACK";
}

export function FoodLogView({
  todayLogs,
  personalFoods,
  targets,
  viewDate,
  isToday,
  healthFlags,
}: {
  todayLogs: TodayLogEntry[];
  personalFoods: PersonalFood[];
  targets: DailyTargets | null;
  viewDate: string;
  isToday: boolean;
  healthFlags: HealthFlags;
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
  // Separates "I'm entering a weight" from "I'm entering a piece/serving
  // count" for a from-scratch food — the root cause of the 100x-inflated
  // library entries was typing "1" meaning "1 piece" into a grams-only
  // field, which per100gFromTotal then read as "1 gram".
  const [customUnitMode, setCustomUnitMode] = useState<"grams" | "unit">("grams");
  const [customUnitLabel, setCustomUnitLabel] = useState("ชิ้น");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGrams, setEditGrams] = useState("");
  const [editMealType, setEditMealType] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [copyingDay, setCopyingDay] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
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
          sugarG: acc.sugarG + (l.sugarG ?? 0),
          sodiumMg: acc.sodiumMg + (l.sodiumMg ?? 0),
          cholesterolMg: acc.cholesterolMg + (l.cholesterolMg ?? 0),
          fiberG: acc.fiberG + (l.fiberG ?? 0),
          hasMicronutrients: acc.hasMicronutrients || l.sugarG != null || l.sodiumMg != null || l.fiberG != null,
        }),
        { calories: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, sodiumMg: 0, cholesterolMg: 0, fiberG: 0, hasMicronutrients: false }
      ),
    [todayLogs]
  );

  const nutrientPages: NutrientPage[] = useMemo(
    () => [
      { key: "calories", label: "แคลอรี่", eaten: totals.calories, target: targets?.targetCalories ?? null, unit: "kcal", color: "#fc4c02" },
      {
        key: "protein",
        label: "โปรตีน",
        eaten: totals.proteinG,
        target: targets?.proteinG ?? null,
        unit: "ก.",
        color: "#38bdf8",
        bonusNote: targets && targets.proteinBonusG > 0 ? `รวมเป้าเพิ่มจากกิจกรรม +${targets.proteinBonusG} ก.` : undefined,
      },
      {
        key: "carb",
        label: "คาร์บ",
        eaten: totals.carbG,
        target: targets?.carbG ?? null,
        unit: "ก.",
        color: "#f59e0b",
        bonusNote: targets && targets.carbBonusG > 0 ? `รวมเป้าเพิ่มจากกิจกรรม +${targets.carbBonusG} ก.` : undefined,
      },
      { key: "fat", label: "ไขมัน", eaten: totals.fatG, target: targets?.fatG ?? null, unit: "ก.", color: "#f43f5e" },
    ],
    [totals, targets]
  );

  // Micronutrients render as a static block below the calorie/macro rings
  // in NutrientOverview, rather than a separate section the user has to
  // scroll to find.
  const micronutrientPage: CustomPage | undefined = totals.hasMicronutrients
    ? {
        key: "micronutrients",
        label: "สารอาหารอื่นๆ",
        content: (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-neutral-900/60 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M12 3c2.5 3.2 6 7.5 6 11.2a6 6 0 0 1-12 0C6 10.5 9.5 6.2 12 3Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p className="text-sm font-bold tabular-nums text-neutral-100">{Math.round(totals.sugarG)} ก.</p>
                <p className="text-[11px] text-neutral-500">น้ำตาล</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-neutral-900/60 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M4 10h16M6 10l1.5 8.5A2 2 0 0 0 9.47 20h5.06a2 2 0 0 0 1.97-1.5L18 10M9 6.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p className="text-sm font-bold tabular-nums text-neutral-100">{Math.round(totals.sodiumMg)} มก.</p>
                <p className="text-[11px] text-neutral-500">โซเดียม</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-neutral-900/60 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M12 21c-4-1-7-5-7-10 0-3 2-6 7-8 5 2 7 5 7 8 0 5-3 9-7 10Zm0-14v14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p className="text-sm font-bold tabular-nums text-neutral-100">{Math.round(totals.fiberG)} ก.</p>
                <p className="text-[11px] text-neutral-500">ไฟเบอร์</p>
              </div>
            </div>
            {healthFlags.highCholesterol && totals.cholesterolMg > 0 && (
              <p
                className={`mt-3 text-center text-xs ${
                  totals.cholesterolMg > DAILY_CHOLESTEROL_LIMIT_MG ? "text-red-400" : "text-neutral-500"
                }`}
              >
                คอเลสเตอรอลวันนี้ {Math.round(totals.cholesterolMg)} / {DAILY_CHOLESTEROL_LIMIT_MG} มก.
                {totals.cholesterolMg > DAILY_CHOLESTEROL_LIMIT_MG && " — เกินเพดานแล้ว"}
              </p>
            )}
          </>
        ),
      }
    : undefined;

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
  // the "เมนูที่กินบ่อย" quick-pick list inside the add-food panel.
  // Memoized like totals/mealGroups above so typing in the search box or
  // editing custom-macro fields doesn't re-sort the list on every keystroke.
  //
  // Ranked by actual logging frequency — a real "what I actually eat"
  // list beats generic catalog dishes the user may never make. Falls back
  // to the catalog only for someone with no logging history yet at all.
  const remainingCalories = targets ? targets.targetCalories - totals.calories : null;
  const frequentPersonalFoods = useMemo(() => personalFoods.filter((f) => f.logCount > 0).sort((a, b) => b.logCount - a.logCount), [personalFoods]);
  const usingFrequent = frequentPersonalFoods.length > 0;
  const suggestions = useMemo(() => {
    if (remainingCalories === null || remainingCalories <= 0) return [];
    if (usingFrequent) {
      // Already sorted by logCount — most-eaten first.
      return frequentPersonalFoods
        .map((f) => ({ food: f, ...macrosForGrams(f, f.typicalGrams) }))
        .filter((s) => s.calories <= remainingCalories)
        .slice(0, 6);
    }
    // No logging history yet at all — fall back to the built-in catalog,
    // ranked by protein density since that's usually the harder macro to
    // hit once there's still calorie headroom to spend.
    return THAI_FOOD_CATALOG.map((f) => ({ food: f, ...macrosForGrams(f, f.typicalGrams) }))
      .filter((s) => s.calories <= remainingCalories)
      .sort((a, b) => b.proteinG - a.proteinG)
      .slice(0, 6);
  }, [remainingCalories, usingFrequent, frequentPersonalFoods]);

  function pickPersonal(food: PersonalFood) {
    setShowAdd(true);
    setPending({ kind: "personal", food, grams: food.typicalGrams });
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
    setCustomUnitMode("grams");
    setCustomUnitLabel("ชิ้น");
    setPending({ kind: "custom", grams: 100 });
  }

  // Switching mode also resets the quantity to a sane default for that mode
  // (100g vs. 1 piece) — only reachable before any macro is typed in, same
  // as the quantity field itself being locked once customMacrosStarted.
  function setCustomMode(mode: "grams" | "unit") {
    setCustomUnitMode(mode);
    setPending((p) => (p?.kind === "custom" ? { kind: "custom", grams: mode === "grams" ? 100 : 1 } : p));
  }

  const customUnitLabelTrimmed = customUnitLabel.trim() || GENERIC_UNIT;

  // What the quantity field means for whichever food is currently pending —
  // "กรัม" for anything gram-based (catalog/label entries, or a custom food
  // in grams mode), otherwise the food's own unit. Reads `pending` straight
  // from the closure rather than taking it as a parameter, since every call
  // site already has it in scope and would otherwise just pass it straight
  // back through.
  function pendingUnitLabel(): string {
    if (!pending) return GRAM_UNIT;
    if (pending.kind === "custom") return customUnitMode === "unit" ? customUnitLabelTrimmed : GRAM_UNIT;
    if (pending.kind === "personal") return pending.food.unitLabel;
    return GRAM_UNIT;
  }

  function handleLabelSubmit(result: FoodLabelResult) {
    setShowScanner(false);
    setPending({ kind: "label", name: result.name, per100g: result.per100g, grams: result.grams });
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
    } else if (pending.kind === "label") {
      body = {
        food: { name: pending.name, ...pending.per100g, source: "LABEL" },
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
      body = { food: { name: customName.trim(), ...per100g, source: "CUSTOM", unitLabel: pendingUnitLabel() }, grams };
    }
    body.mealType = mealType || null;
    if (!isToday) body.loggedAt = viewDate;

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

  function startEdit(l: TodayLogEntry) {
    setEditingId(l.id);
    setEditGrams(String(l.grams));
    setEditMealType(l.mealType ?? "");
    setEditError(null);
  }

  async function saveEdit(id: string) {
    const grams = Number(editGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      setEditError("กรอกปริมาณ (กรัม) ให้ถูกต้อง");
      return;
    }
    setEditError(null);
    setEditSaving(true);
    const res = await fetch(`/api/food/log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams, mealType: editMealType || null }),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      setEditError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  async function repeatLog(id: string) {
    setDeleteError(null);
    setRepeatingId(id);
    const body: Record<string, unknown> = {};
    if (!isToday) body.loggedAt = viewDate;
    const res = await fetch(`/api/food/log/${id}/repeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setRepeatingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      setDeleteError("ทำซ้ำไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  function prevDateKey(dateKey: string): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  async function copyPreviousDay() {
    setCopyError(null);
    setCopyingDay(true);
    const res = await fetch("/api/food/log/copy-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: prevDateKey(viewDate), toDate: viewDate }),
    });
    setCopyingDay(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setCopyError(data.error === "nothing_to_copy" ? "วันก่อนหน้าไม่มีข้อมูลให้คัดลอก" : "คัดลอกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <p className="mb-1 text-center text-xs text-neutral-500">{isToday ? "กินไปวันนี้" : "สรุปวันที่เลือก"}</p>
        <NutrientOverview pages={nutrientPages} extraPage={micronutrientPage} />
      </div>

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
                {pending.kind === "label" && pending.name}
                {pending.kind === "custom" && "เพิ่มเมนูเอง"}
              </h3>

              {pending.kind === "custom" && (
                <div className="mb-3 flex items-center gap-2">
                  <label className="text-xs text-neutral-500">ประเภทปริมาณ</label>
                  <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setCustomMode("grams")}
                      disabled={customMacrosStarted}
                      className={`px-2.5 py-1.5 transition disabled:opacity-50 ${
                        customUnitMode === "grams" ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:bg-neutral-800"
                      }`}
                    >
                      กรัม
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMode("unit")}
                      disabled={customMacrosStarted}
                      className={`border-l border-neutral-700 px-2.5 py-1.5 transition disabled:opacity-50 ${
                        customUnitMode === "unit" ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:bg-neutral-800"
                      }`}
                    >
                      หน่วย/ที่
                    </button>
                  </div>
                  {customUnitMode === "unit" && (
                    <input
                      value={customUnitLabel}
                      onChange={(e) => setCustomUnitLabel(e.target.value)}
                      disabled={customMacrosStarted}
                      placeholder="เช่น ชิ้น, ที่, ถ้วย"
                      className={`${INPUT_CLASS} w-28 disabled:opacity-50`}
                    />
                  )}
                </div>
              )}

              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs text-neutral-500">
                  {(() => {
                    const unitLabel = pendingUnitLabel();
                    return isGramUnit(unitLabel) ? "ปริมาณ (กรัม)" : `จำนวน (${unitLabel})`;
                  })()}
                </label>
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
                  <p className="text-xs text-neutral-500">
                    กรอกแคลอรี่/แมโครสำหรับ {pending.grams || 0} {pendingUnitLabel()} ด้านบน
                  </p>
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
            <FoodLabelScanner onSubmit={handleLabelSubmit} onClose={() => setShowScanner(false)} />
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
                  onClick={() => setShowScanner(true)}
                  className="flex flex-none items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-600"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                    <path
                      d="M4 8a2 2 0 0 1 2-2h1l.9-1.3h4.2L13 6h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="11" r="2.6" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                  สแกนฉลาก
                </button>
              </div>

              {!query.trim() && suggestions.length > 0 && (
                <div className="mb-1">
                  <div className="mb-1 flex items-center justify-between px-1">
                    <p className="text-[11px] text-neutral-600">{usingFrequent ? "เมนูที่กินบ่อย" : "แนะนำจากรายการอาหารไทย"}</p>
                    <span className="text-[11px] text-neutral-600">เหลือ {Math.round(remainingCalories ?? 0)} kcal วันนี้</span>
                  </div>
                  <div className="space-y-1">
                    {suggestions.map((s) => (
                      <button
                        key={usingFrequent ? (s.food as PersonalFood).id : s.food.name}
                        onClick={() => (usingFrequent ? pickPersonal(s.food as PersonalFood) : pickCatalog(s.food as CatalogFood))}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-neutral-800/50"
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
                          <span className="text-xs text-neutral-500">
                            {Math.round(macrosForGrams(f, referenceQuantity(f.unitLabel)).calories)} kcal/{referenceQuantityLabel(f.unitLabel)}
                          </span>
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
        <div className="rounded-xl border border-dashed border-neutral-800 px-5 py-4 text-center">
          <p className="text-xs text-neutral-600">ยังไม่ได้บันทึก</p>
          <button
            onClick={copyPreviousDay}
            disabled={copyingDay}
            className="mt-2 text-xs text-lime-400 hover:underline disabled:opacity-50"
          >
            {copyingDay ? "กำลังคัดลอก..." : "คัดลอกจากวันก่อนหน้าทั้งหมด"}
          </button>
          {copyError && <p className="mt-1 text-xs text-red-400">{copyError}</p>}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {todayLogs.map((l) =>
            editingId === l.id ? (
              <li key={l.id} className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-5 py-4">
                <p className="mb-3 truncate text-sm font-medium text-neutral-200">{l.foodName}</p>
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-xs text-neutral-500">
                    {isGramUnit(l.unitLabel) ? "ปริมาณ (กรัม)" : `จำนวน (${l.unitLabel})`}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editGrams}
                    onChange={(e) => setEditGrams(e.target.value)}
                    className={`${INPUT_CLASS} w-24`}
                  />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-xs text-neutral-500">มื้อ</label>
                  <select
                    value={editMealType}
                    onChange={(e) => setEditMealType(e.target.value)}
                    className={`${INPUT_CLASS} w-36`}
                  >
                    {MEAL_TYPE_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mb-2 text-xs text-neutral-600">
                  แก้ได้แค่ปริมาณ/มื้อตรงนี้ — ค่าแคลอรี่/โปรตีน/คาร์บ/ไขมันของเมนูนี้ ไปแก้ได้ที่{" "}
                  <Link href={`/dashboard/food/library?edit=${l.foodId}`} className="text-lime-400 hover:underline">
                    คลังอาหารส่วนตัว
                  </Link>{" "}
                  (แก้ที่นั่นจะมีผลกับทุกครั้งที่เคยบันทึกเมนูนี้ด้วย)
                </p>
                {editError && <p className="mb-2 text-xs text-red-400">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(l.id)}
                    disabled={editSaving}
                    className="rounded-lg bg-[#fc4c02] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
                  >
                    {editSaving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
                  >
                    ยกเลิก
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-200">
                    <span className="truncate">{l.foodName}</span>
                    {healthFlags.highUricAcid && matchesPurineKeyword(l.foodName) && (
                      <span
                        title="มีพิวรีนสูง — ระวังถ้ากรดยูริกสูง"
                        className="flex-none rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                      >
                        พิวรีนสูง
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {Math.round(l.grams)} {l.unitLabel} · {Math.round(l.calories)} kcal
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2.5">
                  <button
                    onClick={() => repeatLog(l.id)}
                    disabled={repeatingId === l.id}
                    className="text-neutral-600 transition hover:text-lime-400 disabled:opacity-50"
                    title="ทำซ้ำ"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <rect x="7" y="7" width="9" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4 13V5.5A1.5 1.5 0 0 1 5.5 4H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button onClick={() => startEdit(l)} className="text-neutral-600 transition hover:text-neutral-300" title="แก้ไข">
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path d="M4 16l.5-2.8L13 4.7l2.3 2.3L6.8 15.5 4 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      <path d="M11.3 6.4l2.3 2.3" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                  <button onClick={() => deleteLog(l.id)} className="text-neutral-600 transition hover:text-red-400" title="ลบ">
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
