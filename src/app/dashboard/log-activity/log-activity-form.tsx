"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseActivityText } from "@/lib/activity-import-parse";
import { estimateCalories, type Intensity } from "@/lib/calorie-estimate";
import type { ExerciseStat } from "@/lib/exercise-stats";
import { formatActivityDate } from "@/lib/format";

const TYPES = [
  { value: "Run", label: "วิ่ง" },
  { value: "Ride", label: "ปั่นจักรยาน" },
  { value: "Walk", label: "เดิน" },
  { value: "Swim", label: "ว่ายน้ำ" },
  { value: "WeightTraining", label: "เวทเทรนนิ่ง" },
  { value: "Football", label: "ฟุตบอล" },
  { value: "Badminton", label: "แบดมินตัน" },
  { value: "Workout", label: "ออกกำลังกายทั่วไป" },
];

const INTENSITIES = [
  { value: "LOW", label: "เบา" },
  { value: "MODERATE", label: "ปานกลาง" },
  { value: "HIGH", label: "หนัก" },
];

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";
const LABEL_CLASS = "mb-1 block text-xs text-neutral-500";

// A ready-made prompt for pasting a workout screenshot (Huawei Health,
// Apple Health, Garmin, ...) into an external AI chat — same zero-API-cost
// pattern as food's/InBody's "นำเข้าจาก AI" (import-meal-panel.tsx,
// body-composition-import-parse.ts): MooPaTa never calls a vision API
// itself. The exercise-table request only matters for weight training, but
// asking for it unconditionally is simpler than trying to have the AI
// decide whether to include it — an unused "ท่า:" section is just ignored
// by parseActivityText for a cardio activity.
const AI_PROMPT_TEMPLATE = `อ่านค่าจากรูปสรุปกิจกรรมที่แนบมาให้หน่อย (จากแอพนาฬิกา/สายรัดข้อมือ เช่น Huawei Health, Apple Health, Garmin) แล้วตอบกลับมาแค่บรรทัดเหล่านี้เป๊ะๆ ไม่ต้องมีคำอธิบายอื่นแทรก (ค่าไหนไม่มีในรูปให้ใส่ "-" แทน):
ประเภท: [วิ่ง/ปั่นจักรยาน/เดิน/ว่ายน้ำ/เวทเทรนนิ่ง/ฟุตบอล/แบดมินตัน/อื่นๆ]
ระยะเวลา: [เช่น 02:53:39 หรือจำนวนนาที]
ระยะทาง: [กม.]
แคลอรี่: [kcal]
หัวใจเฉลี่ย: [bpm]
หัวใจสูงสุด: [bpm]

ถ้าเป็นเวทเทรนนิ่ง ให้ใส่รายการท่าต่อท้ายด้วย บรรทัดละท่า รูปแบบ "ชื่อท่า | เซ็ท | ครั้ง | น้ำหนัก(กก.)":
ท่า:
ดันไหล่ดัมเบล | 3 | 12 | 20`;

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ExerciseRow {
  id: number;
  name: string;
  sets: string;
  reps: string;
  weightKg: string;
}

let nextExerciseRowId = 1;
function emptyExerciseRow(): ExerciseRow {
  return { id: nextExerciseRowId++, name: "", sets: "3", reps: "12", weightKg: "" };
}

export interface LogActivityInitial {
  type: string;
  name: string;
  durationMin: string;
  intensity: string;
  startedAt: string; // already in the datetime-local input's "YYYY-MM-DDTHH:mm" shape
  distanceKm: string;
  avgHeartRate: string;
  maxHeartRate: string;
  calories: string;
  exercises: { name: string; sets: string; reps: string; weightKg: string }[];
}

// Same form for both logging a new activity and editing an existing
// manually-logged one — passing `activityId` (+ `initial` to prefill from)
// switches save() to PATCH /api/activity/[id] instead of POST
// /api/activity/manual, and lands back on the activity's own detail page
// instead of the dashboard afterward. Editing is only ever offered for
// provider: "MANUAL" activities (see that route's comment for why), so
// there's no case here where this form needs to represent Strava-only
// fields it was never built to show.
export function LogActivityForm({
  activityId,
  initial,
  exerciseStats = [],
  userWeightKg = null,
}: {
  activityId?: string;
  initial?: LogActivityInitial;
  exerciseStats?: ExerciseStat[];
  userWeightKg?: number | null;
}) {
  const router = useRouter();
  const [type, setType] = useState(initial?.type ?? TYPES[0].value);
  const [name, setName] = useState(initial?.name ?? "");
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? "60");
  const [intensity, setIntensity] = useState(initial?.intensity ?? "MODERATE");
  const [startedAt, setStartedAt] = useState(initial?.startedAt ?? (() => toDatetimeLocal(new Date())));
  const [distanceKm, setDistanceKm] = useState(initial?.distanceKm ?? "");
  const [avgHeartRate, setAvgHeartRate] = useState(initial?.avgHeartRate ?? "");
  const [maxHeartRate, setMaxHeartRate] = useState(initial?.maxHeartRate ?? "");
  const [calories, setCalories] = useState(initial?.calories ?? "");
  const [exercises, setExercises] = useState<ExerciseRow[]>(
    () => initial?.exercises.map((e) => ({ id: nextExerciseRowId++, ...e })) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [pasteText, setPasteText] = useState("");
  const [copied, setCopied] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Keyed by trimmed+lowercased name, same normalization getExerciseStats
  // uses server-side, so a row typed with different casing/spacing still
  // finds its history.
  const statsByName = useMemo(() => {
    const map = new Map<string, ExerciseStat>();
    for (const s of exerciseStats) map.set(s.name.trim().toLowerCase(), s);
    return map;
  }, [exerciseStats]);

  // A rough MET-based suggestion (src/lib/calorie-estimate.ts) shown only
  // while the calories field is empty — this is the one field almost nobody
  // bothers typing in by hand, which then leaves it missing everywhere that
  // reads it (records page's calorie tab, the activity share card's hero
  // number). Never auto-fills the field itself: same "show it, let the user
  // confirm" pattern as the exercise history hint below, since a wrong
  // guess silently sitting in a field the user didn't type is worse than an
  // empty one.
  const estimatedCalories = useMemo(() => {
    const min = Number(durationMin);
    if (!Number.isFinite(min) || min <= 0) return null;
    return estimateCalories({ type, intensity: intensity as Intensity, durationSec: min * 60, weightKg: userWeightKg });
  }, [type, intensity, durationMin, userWeightKg]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setImportNotice("คัดลอกไม่สำเร็จ ลองกดค้างที่ข้อความด้านล่างเพื่อคัดลอกเองแทน");
    }
  }

  function applyParsedText() {
    const parsed = parseActivityText(pasteText);
    if (parsed.type && TYPES.some((t) => t.value === parsed.type)) setType(parsed.type);
    if (parsed.durationMin !== null) setDurationMin(String(parsed.durationMin));
    if (parsed.distanceKm !== null) setDistanceKm(String(parsed.distanceKm));
    if (parsed.calories !== null) setCalories(String(parsed.calories));
    if (parsed.avgHeartRate !== null) setAvgHeartRate(String(parsed.avgHeartRate));
    if (parsed.maxHeartRate !== null) setMaxHeartRate(String(parsed.maxHeartRate));
    if (parsed.exercises.length > 0) {
      setExercises((rows) => [
        ...rows,
        ...parsed.exercises.map((e) => ({
          id: nextExerciseRowId++,
          name: e.name,
          sets: String(e.sets),
          reps: String(e.reps),
          weightKg: e.weightKg !== null ? String(e.weightKg) : "",
        })),
      ]);
    }

    const gotAnything =
      parsed.type !== null ||
      parsed.durationMin !== null ||
      parsed.distanceKm !== null ||
      parsed.calories !== null ||
      parsed.avgHeartRate !== null ||
      parsed.maxHeartRate !== null ||
      parsed.exercises.length > 0;
    if (!gotAnything) {
      setImportNotice("อ่านค่าไม่ได้เลย ลองวางข้อความใหม่ หรือดูว่าตรงกับตัวอย่างมั้ย");
      return;
    }
    setImportNotice(null);
    setMode("manual");
  }

  function addExerciseRow() {
    setExercises((rows) => [...rows, emptyExerciseRow()]);
  }
  function updateExerciseRow(id: number, patch: Partial<ExerciseRow>) {
    setExercises((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeExerciseRow(id: number) {
    setExercises((rows) => rows.filter((r) => r.id !== id));
  }

  async function save() {
    if (!Number.isFinite(Number(durationMin)) || Number(durationMin) <= 0) {
      setError("กรอกระยะเวลาให้ถูกต้องก่อน");
      return;
    }
    const namedExercises = exercises.filter((r) => r.name.trim());
    for (const r of namedExercises) {
      const sets = Number(r.sets);
      const reps = Number(r.reps);
      if (!Number.isInteger(sets) || sets <= 0 || !Number.isInteger(reps) || reps <= 0) {
        setError(`ท่า "${r.name.trim()}" ต้องกรอกเซ็ทและครั้งเป็นจำนวนเต็มมากกว่า 0`);
        return;
      }
    }
    setError(null);
    setSaving(true);
    const res = await fetch(activityId ? `/api/activity/${activityId}` : "/api/activity/manual", {
      method: activityId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        name: name.trim() || null,
        durationMin: Number(durationMin),
        intensity,
        startedAt: new Date(startedAt).toISOString(),
        distanceKm: distanceKm.trim() || undefined,
        avgHeartRate: avgHeartRate.trim() || undefined,
        maxHeartRate: maxHeartRate.trim() || undefined,
        calories: calories.trim() || undefined,
        exercises: namedExercises.map((r) => ({
          name: r.name.trim(),
          sets: Number(r.sets),
          reps: Number(r.reps),
          weightKg: r.weightKg.trim() || undefined,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.push(activityId ? `/dashboard/activity/${activityId}` : "/dashboard");
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="flex gap-1.5 text-xs">
        <button
          onClick={() => setMode("manual")}
          className={`rounded-md px-2.5 py-1 font-medium transition ${
            mode === "manual" ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          กรอกเอง
        </button>
        <button
          onClick={() => setMode("import")}
          className={`rounded-md px-2.5 py-1 font-medium transition ${
            mode === "import" ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          นำเข้าจาก AI
        </button>
      </div>

      {mode === "import" && (
        <div className="space-y-2">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
            <p className="text-xs text-neutral-400">
              1. คัดลอกคำสั่งนี้ไปวางถาม AI (Claude, ChatGPT) แล้วแนบรูปสรุปกิจกรรมจากแอพนาฬิกา/สายรัดเข้าไปด้วย
            </p>
            <button
              type="button"
              onClick={copyPrompt}
              className="mt-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
            >
              {copied ? "คัดลอกแล้ว ✓" : "คัดลอกคำสั่งสำหรับถาม AI"}
            </button>
            <p className="mt-2 text-xs text-neutral-400">2. คัดลอกคำตอบที่ได้มาวางในช่องด้านล่างนี้</p>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`ประเภท: วิ่ง\nระยะเวลา: 02:53:39\nระยะทาง: 5.2\nแคลอรี่: 350\nหัวใจเฉลี่ย: 130\nหัวใจสูงสุด: 165`}
            rows={7}
            className={`${INPUT_CLASS} resize-y font-mono text-xs`}
          />
          {importNotice && <p className="text-xs text-amber-400">{importNotice}</p>}
          <button
            onClick={applyParsedText}
            disabled={!pasteText.trim()}
            className="rounded-lg bg-[#fc4c02] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
          >
            แปลงข้อมูล
          </button>
        </div>
      )}

      {mode === "manual" && (
        <>
        <div>
          <label className={LABEL_CLASS}>ประเภทกิจกรรม</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLASS}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>ชื่อกิจกรรม (ไม่บังคับ)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เตะบอลกับเพื่อน" className={INPUT_CLASS} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>ระยะเวลา (นาที)</label>
            <input
              type="number"
              min="1"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>ความหนัก</label>
            <select value={intensity} onChange={(e) => setIntensity(e.target.value)} className={INPUT_CLASS}>
              {INTENSITIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>วันเวลาที่ทำกิจกรรม</label>
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="border-t border-neutral-800 pt-4">
          <p className="mb-3 text-xs text-neutral-500">
            ข้อมูลเพิ่มเติม (ไม่บังคับ) — คัดลอกจากแอพนาฬิกา/สายรัดที่บันทึกไว้ได้
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>ระยะทาง (กม.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>แคลอรี่ (kcal)</label>
              <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} className={INPUT_CLASS} />
              {!calories.trim() && estimatedCalories !== null && (
                <button
                  type="button"
                  onClick={() => setCalories(String(estimatedCalories))}
                  className="mt-1 text-left text-[11px] text-neutral-500 underline decoration-dotted transition hover:text-neutral-300"
                >
                  ประมาณ ~{estimatedCalories} kcal (ใช้ค่านี้)
                </button>
              )}
            </div>
            <div>
              <label className={LABEL_CLASS}>หัวใจเฉลี่ย (bpm)</label>
              <input
                type="number"
                min="0"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>หัวใจสูงสุด (bpm)</label>
              <input
                type="number"
                min="0"
                value={maxHeartRate}
                onChange={(e) => setMaxHeartRate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 pt-4">
          <p className="mb-3 text-xs text-neutral-500">
            ท่าออกกำลังกาย (ไม่บังคับ) — สำหรับเวทเทรนนิ่ง/แคลิสเธนิกส์ ใส่ทีละท่าพร้อมเซ็ท/ครั้ง/น้ำหนักที่ใช้
          </p>
          {exercises.length > 0 && (
            <div className="mb-2 space-y-2">
              {exercises.map((r) => {
                const match = statsByName.get(r.name.trim().toLowerCase());
                return (
                <div key={r.id} className="rounded-lg border border-neutral-800 p-2.5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <input
                      value={r.name}
                      onChange={(e) => updateExerciseRow(r.id, { name: e.target.value })}
                      placeholder="ชื่อท่า เช่น ดันไหล่ดัมเบล"
                      list="exercise-name-history"
                      className={`${INPUT_CLASS} flex-1`}
                    />
                    <button
                      onClick={() => removeExerciseRow(r.id)}
                      title="ลบท่านี้"
                      className="flex-none text-neutral-600 hover:text-red-400"
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {match && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-neutral-800/50 px-2 py-1.5 text-xs text-neutral-400">
                      <span>
                        ครั้งก่อน ({formatActivityDate(new Date(match.latestAtMs))}): {match.latestSets} เซ็ท ×{" "}
                        {match.latestReps} ครั้ง
                        {match.latestWeightKg !== null && ` @ ${match.latestWeightKg} กก.`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateExerciseRow(r.id, {
                            sets: String(match.latestSets),
                            reps: String(match.latestReps),
                            weightKg: match.latestWeightKg !== null ? String(match.latestWeightKg) : "",
                          })
                        }
                        className="flex-none rounded border border-neutral-700 px-1.5 py-0.5 font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
                      >
                        ใช้ค่านี้
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={r.sets}
                        onChange={(e) => updateExerciseRow(r.id, { sets: e.target.value })}
                        className={INPUT_CLASS}
                      />
                      <p className="mt-0.5 text-center text-[10px] text-neutral-600">เซ็ท</p>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={r.reps}
                        onChange={(e) => updateExerciseRow(r.id, { reps: e.target.value })}
                        className={INPUT_CLASS}
                      />
                      <p className="mt-0.5 text-center text-[10px] text-neutral-600">ครั้ง/เซ็ท</p>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={r.weightKg}
                        onChange={(e) => updateExerciseRow(r.id, { weightKg: e.target.value })}
                        placeholder="ไม่มี"
                        className={INPUT_CLASS}
                      />
                      <p className="mt-0.5 text-center text-[10px] text-neutral-600">น้ำหนัก (กก.)</p>
                    </div>
                  </div>
                </div>
                );
              })}
              <datalist id="exercise-name-history">
                {exerciseStats.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
            </div>
          )}
          <button
            onClick={addExerciseRow}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-600"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            เพิ่มท่า
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : activityId ? "บันทึกการแก้ไข" : "บันทึกกิจกรรม"}
        </button>
        </>
      )}
    </div>
  );
}
