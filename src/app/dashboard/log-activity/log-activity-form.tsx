"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseActivityText } from "@/lib/activity-import-parse";
import { estimateCalories, type Intensity } from "@/lib/calorie-estimate";
import type { ExerciseStat, LastWorkoutSession } from "@/lib/exercise-stats";
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

// Whole-session RPE — Borg/talk-test framing (how hard is it to breathe/
// talk right now), same scale most watch apps show. A `title` tooltip
// alone doesn't work on mobile (no hover), so RpeLevelsGuide below renders
// this as a tappable <details> reference next to the field instead.
const RPE_CARDIO_LEVELS: { level: string; label: string; desc: string }[] = [
  { level: "10", label: "หนักสุดขีด", desc: "รู้สึกเหมือนจะหายใจไม่ออก พูดไม่ได้เลยสักคำ" },
  { level: "9", label: "เกือบสุด", desc: "พูดได้ไม่เกิน 2-3 คำ หายใจหอบมาก" },
  { level: "8", label: "หนักมากเป็นพิเศษ", desc: "พูดแทบไม่ออก หายใจหนักและลำบากมาก" },
  { level: "7", label: "ลำบากมาก", desc: "พูดได้แค่ประโยคสั้น ๆ ทีละประโยค" },
  { level: "6", label: "ท้าทาย", desc: "หายใจหอบชัดเจน พูดประโยคยาว ๆ ลำบาก" },
  { level: "5", label: "หนัก", desc: "หายใจถี่ขึ้น ยังสนทนาต่อได้ถ้าฝืนหน่อย" },
  { level: "4", label: "ค่อนข้างหนัก", desc: "หายใจแรงขึ้นแต่ยังคุมได้ สนทนาได้แต่ต้องใช้ความพยายาม" },
  { level: "3", label: "ปานกลาง", desc: "รักษาจังหวะนี้ได้เป็นชั่วโมง พูดคุย/อ่านหนังสือไปด้วยได้สบาย" },
  { level: "2", label: "เบา", desc: "หายใจแทบไม่ต่างจากปกติ พูดคุยได้สบาย ๆ" },
  { level: "1", label: "เบามาก", desc: "แทบไม่รู้สึกออกแรงเลย เหมือนกำลังพักผ่อน" },
];

// Per-set RPE — reps-in-reserve framing (how many more reps could you have
// done), a different scale from the cardio one above on purpose (see
// ExerciseSet.rpe's schema comment).
const RPE_LIFT_LEVELS: { level: string; label: string; desc: string }[] = [
  { level: "10", label: "ยกไม่ไหวแล้ว", desc: "ทำจนสุดแรง ไม่เหลือแม้แต่ครั้งเดียว" },
  { level: "9", label: "เกือบสุด", desc: "เหลือแรงอีกแค่ 1 ครั้ง" },
  { level: "8", label: "หนัก", desc: "เหลือแรงอีกประมาณ 2 ครั้ง" },
  { level: "7", label: "ค่อนข้างหนัก", desc: "เหลือแรงอีกประมาณ 3 ครั้ง" },
  { level: "5-6", label: "ปานกลาง", desc: "เหลือแรงอีก 4-6 ครั้ง" },
  { level: "1-4", label: "เบา", desc: "ยังไหวอีกเยอะ เช่น เซ็ทวอร์มอัพ" },
];

function RpeLevelsGuide({ title, levels }: { title: string; levels: { level: string; label: string; desc: string }[] }) {
  return (
    <details className="mt-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
      <summary className="cursor-pointer text-[11px] font-medium text-neutral-400">{title}</summary>
      <div className="mt-2 space-y-1.5">
        {levels.map((l) => (
          <div key={l.level} className="flex gap-2 text-[11px]">
            <span className="w-8 flex-none text-right font-bold tabular-nums text-neutral-300">{l.level}</span>
            <span className="text-neutral-400">
              <span className="font-medium text-neutral-300">{l.label}</span> — {l.desc}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

// A ready-made prompt for pasting a workout screenshot (Huawei Health,
// Apple Health, Garmin, ...) into an external AI chat — same zero-API-cost
// pattern as food's/InBody's "นำเข้าจาก AI" (import-meal-panel.tsx,
// body-composition-import-parse.ts): MooPaTa never calls a vision API
// itself. The exercise-table request only matters for weight training, but
// asking for it unconditionally is simpler than trying to have the AI
// decide whether to include it — an unused "ท่า:" section is just ignored
// by parseActivityText for a cardio activity.
const AI_PROMPT_TEMPLATE = `อ่านค่าจากรูปสรุปกิจกรรมที่แนบมาให้หน่อย (จากแอพนาฬิกา/สายรัดข้อมือ เช่น Huawei Health, Apple Health, Garmin, Zepp) แล้วตอบกลับมาแค่บรรทัดเหล่านี้เป๊ะๆ ไม่ต้องมีคำอธิบายอื่นแทรก (ค่าไหนไม่มีในรูปให้ใส่ "-" แทน):
ประเภท: [วิ่ง/ปั่นจักรยาน/เดิน/ว่ายน้ำ/เวทเทรนนิ่ง/ฟุตบอล/แบดมินตัน/อื่นๆ]
ระยะเวลา: [เช่น 02:53:39 หรือจำนวนนาที]
ระยะทาง: [กม.]
แคลอรี่: [kcal]
หัวใจเฉลี่ย: [bpm]
หัวใจสูงสุด: [bpm]
เคเดนซ์เฉลี่ย: [spm ถ้าวิ่ง/เดิน หรือ rpm ถ้าปั่นจักรยาน]
ระดับความเหนื่อย: [RPE 1-10 ถ้ารูปมีบอกไว้]
หมายเหตุ: [สรุปข้อมูลอื่นที่มีในรูปแต่ไม่ตรงกับหัวข้อด้านบนเป็นประโยคสั้นๆ บรรทัดเดียว เช่น Training Effect, VO2max, โซนหัวใจ, กล้ามเนื้อที่ใช้ — ถ้าไม่มีข้อมูลอื่นเหลือให้ใส่ "-"]

ถ้าเป็นเวทเทรนนิ่ง ให้ใส่รายการท่าต่อท้ายด้วย หนึ่งบรรทัดต่อหนึ่งเซ็ทที่ทำจริง (ถ้าท่าเดียวกันทำหลายเซ็ทที่ตัวเลขต่างกัน ให้แยกคนละบรรทัด อย่ารวมเป็นค่าเดียว) รูปแบบ "ชื่อท่า | เซ็ทที่ | ครั้ง | น้ำหนัก(กก.) | RPE" (คอลัมน์ RPE ใส่แค่ถ้ารูปบอกไว้ ไม่งั้นเว้นว่าง — ถ้ารูปไม่ได้บอกน้ำหนักที่ยกไว้เลย เช่นนาฬิกาที่นับได้แค่จำนวนครั้งจากการเคลื่อนไหว ให้เว้นคอลัมน์น้ำหนักว่างไว้เช่นกัน):
ท่า:
ดันไหล่ดัมเบล | 1 | 15 | 5 | 8
ดันไหล่ดัมเบล | 2 | 14 | 5 | 8
ดันไหล่ดัมเบล | 3 | 10 | 4 | 9`;

// Which distance a "best pace" is expressed per, by activity type — Run
// reads per km, Swim per 100m (swimmers don't talk in km/h or km pace), and
// everything else has no pace convention at all, just plain speed. Mirrors
// activitySpeedValue's per-type dispatch in src/lib/format.ts, which is what
// ends up displaying whatever this form writes to Activity.maxSpeedMs.
function paceUnitMeters(type: string): number | null {
  if (type === "Run") return 1000;
  if (type === "Swim") return 100;
  return null;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface SetRow {
  id: number;
  reps: string;
  weightKg: string;
  // Reps-in-reserve framing (1-10) — see ExerciseSet.rpe's schema comment.
  // Distinct from the whole-session `rpe` field below (Activity.rpe,
  // Borg/talk-test framing).
  rpe: string;
}

interface ExerciseRow {
  id: number;
  name: string;
  sets: SetRow[];
}

let nextRowId = 1;
function emptySetRow(): SetRow {
  return { id: nextRowId++, reps: "12", weightKg: "", rpe: "" };
}
function emptyExerciseRow(): ExerciseRow {
  // Three sets by default — the common case — rather than starting from
  // one and making everyone tap "เพิ่มเซ็ท" twice just to reach a normal
  // working set count; each one is still fully editable/removable on its
  // own since reps/weight no longer have to match across sets.
  return { id: nextRowId++, name: "", sets: [emptySetRow(), emptySetRow(), emptySetRow()] };
}

// Turns a set-history shape (ExerciseSetSummary from exercise-stats.ts, or
// the equivalent per-set entries on a LastWorkoutSession) into editable
// SetRows with fresh ids — shared by useLastTime (one exercise) and
// useLastWorkout (a whole session) below so the two "prefill from history"
// paths can't drift apart on how a set turns into form state.
function toSetRows(sets: { reps: number; weightKg: number | null; rpe: number | null }[]): SetRow[] {
  return sets.map((s) => ({
    id: nextRowId++,
    reps: String(s.reps),
    weightKg: s.weightKg !== null ? String(s.weightKg) : "",
    rpe: s.rpe !== null ? String(s.rpe) : "",
  }));
}

// Compact "15×5kg (RPE 8), 14×5kg (RPE 8), 10×4kg (RPE 9)" summary for the
// "ครั้งก่อน" hint — bodyweight sets (weightKg null) show as just "N ครั้ง"
// with no "×weight", and a set logged without RPE just omits that part.
function formatSetsCompact(sets: { reps: number; weightKg: number | null; rpe: number | null }[]): string {
  return sets
    .map((s) => {
      const base = s.weightKg !== null ? `${s.reps}×${s.weightKg}กก.` : `${s.reps}ครั้ง`;
      return s.rpe !== null ? `${base} (RPE ${s.rpe})` : base;
    })
    .join(", ");
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
  avgCadence: string;
  maxSpeedMs: string;
  rpe: string;
  notes: string;
  exercises: { name: string; sets: { reps: string; weightKg: string; rpe: string }[] }[];
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
  lastWorkoutSession = null,
  userWeightKg = null,
}: {
  activityId?: string;
  initial?: LogActivityInitial;
  exerciseStats?: ExerciseStat[];
  lastWorkoutSession?: LastWorkoutSession | null;
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
  const [avgCadence, setAvgCadence] = useState(initial?.avgCadence ?? "");
  // Split into per-type fields (mm:ss pace vs. plain km/h speed) rather than
  // one raw m/s field, since that's how someone reads it off their own
  // watch — converted to/from Activity.maxSpeedMs (m/s) only at save/load
  // time. Seeded from `initial.maxSpeedMs` using the activity's *loaded*
  // type (not the live `type` state below) since that's the type it was
  // actually recorded/converted under; switching the type dropdown after
  // that just changes which of these three fields is shown, not any
  // stored value, so nothing here needs to react to that switch.
  const initialMaxSpeedMs = initial?.maxSpeedMs ? Number(initial.maxSpeedMs) : null;
  const initialPaceUnit = initial ? paceUnitMeters(initial.type) : null;
  const [bestPaceMin, setBestPaceMin] = useState(() => {
    if (!initialMaxSpeedMs || !initialPaceUnit) return "";
    return String(Math.floor(initialPaceUnit / initialMaxSpeedMs / 60));
  });
  const [bestPaceSec, setBestPaceSec] = useState(() => {
    if (!initialMaxSpeedMs || !initialPaceUnit) return "";
    return String(Math.round((initialPaceUnit / initialMaxSpeedMs) % 60));
  });
  const [bestSpeedKmh, setBestSpeedKmh] = useState(() => {
    if (!initialMaxSpeedMs || initialPaceUnit) return "";
    return String(Math.round(initialMaxSpeedMs * 3.6 * 10) / 10);
  });
  const [rpe, setRpe] = useState(initial?.rpe ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [exercises, setExercises] = useState<ExerciseRow[]>(
    () =>
      initial?.exercises.map((e) => ({
        id: nextRowId++,
        name: e.name,
        sets: e.sets.map((s) => ({ id: nextRowId++, ...s })),
      })) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live off the current `type` dropdown (not initial's), so switching
  // between e.g. Run and WeightTraining mid-edit swaps which of the three
  // best-pace/speed fields above is shown immediately.
  const paceUnit = paceUnitMeters(type);
  const usesPace = paceUnit !== null;

  // Converts whichever of the three fields is currently visible into
  // Activity.maxSpeedMs (m/s) for the request body — `null` means nothing
  // was entered (leave the activity's own maxSpeedMs untouched/unset), and
  // `NaN` signals "entered but not a valid number" so save() can reject it
  // with a specific message instead of silently dropping it (same
  // "invalid input fails loudly" rule as RPE above).
  function computeBestSpeedMs(): number | null {
    if (usesPace) {
      if (!bestPaceMin.trim() && !bestPaceSec.trim()) return null;
      const min = bestPaceMin.trim() ? Number(bestPaceMin) : 0;
      const sec = bestPaceSec.trim() ? Number(bestPaceSec) : 0;
      if (!Number.isFinite(min) || !Number.isFinite(sec) || min < 0 || sec < 0 || sec >= 60) return NaN;
      const totalSec = min * 60 + sec;
      if (totalSec <= 0) return NaN;
      return (paceUnit as number) / totalSec;
    }
    if (!bestSpeedKmh.trim()) return null;
    const kmh = Number(bestSpeedKmh);
    if (!Number.isFinite(kmh) || kmh <= 0) return NaN;
    return kmh / 3.6;
  }

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
    if (parsed.avgCadence !== null) setAvgCadence(String(parsed.avgCadence));
    if (parsed.rpe !== null) setRpe(String(parsed.rpe));
    if (parsed.notes !== null) setNotes(parsed.notes);
    if (parsed.exercises.length > 0) {
      // parseActivityText already gives one entry per set actually
      // performed (see activity-import-parse.ts), so a pyramid/drop set
      // comes through with its real per-set reps/weight/RPE — no
      // expansion/guessing needed here, just a straight mapping.
      setExercises((rows) => [
        ...rows,
        ...parsed.exercises.map((e) => ({
          id: nextRowId++,
          name: e.name,
          sets: e.sets.map((s) => ({
            id: nextRowId++,
            reps: String(s.reps),
            weightKg: s.weightKg !== null ? String(s.weightKg) : "",
            rpe: s.rpe !== null ? String(s.rpe) : "",
          })),
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
      parsed.avgCadence !== null ||
      parsed.rpe !== null ||
      parsed.notes !== null ||
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
  function updateExercise(id: number, patch: Partial<ExerciseRow>) {
    setExercises((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeExerciseRow(id: number) {
    setExercises((rows) => rows.filter((r) => r.id !== id));
  }
  function addSetRow(exerciseId: number) {
    setExercises((rows) => rows.map((r) => (r.id === exerciseId ? { ...r, sets: [...r.sets, emptySetRow()] } : r)));
  }
  function updateSetRow(exerciseId: number, setId: number, patch: Partial<SetRow>) {
    setExercises((rows) =>
      rows.map((r) => (r.id === exerciseId ? { ...r, sets: r.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : r))
    );
  }
  function removeSetRow(exerciseId: number, setId: number) {
    setExercises((rows) =>
      rows.map((r) => (r.id === exerciseId ? { ...r, sets: r.sets.filter((s) => s.id !== setId) } : r))
    );
  }
  function useLastTime(exerciseId: number, stat: ExerciseStat) {
    updateExercise(exerciseId, { sets: toSetRows(stat.latestSets) });
  }

  // Prefills every exercise and every set from the last logged session in
  // one tap, instead of adding each exercise row by hand and then hitting
  // "ใช้ค่านี้" once per row — worth it for anyone whose routine repeats
  // close to the same exercises/sets from one session to the next (a
  // pattern the request that prompted this feature showed clearly). Only
  // offered while the exercise list is still empty (see the button's own
  // guard below) — same "confirm before applying, never silently
  // overwrite in-progress input" rule as useLastTime above.
  function useLastWorkout() {
    if (!lastWorkoutSession) return;
    setExercises(
      lastWorkoutSession.exercises.map((ex) => ({ id: nextRowId++, name: ex.name, sets: toSetRows(ex.sets) }))
    );
  }

  async function save() {
    if (!Number.isFinite(Number(durationMin)) || Number(durationMin) <= 0) {
      setError("กรอกระยะเวลาให้ถูกต้องก่อน");
      return;
    }
    if (rpe.trim()) {
      const n = Number(rpe);
      if (!Number.isFinite(n) || !Number.isInteger(n * 2) || n < 1 || n > 10) {
        setError("ระดับความเหนื่อย (RPE) ต้องเป็นจำนวนเต็มหรือครึ่ง (เช่น 7, 7.5) ระหว่าง 1-10 เท่านั้น");
        return;
      }
    }
    const bestSpeedMs = computeBestSpeedMs();
    if (Number.isNaN(bestSpeedMs)) {
      setError(
        usesPace
          ? "กรอกเพซที่ดีที่สุดให้ถูกต้อง (นาที/วินาทีเป็นตัวเลขไม่ติดลบ วินาทีต้องน้อยกว่า 60)"
          : "กรอกความเร็วสูงสุดให้ถูกต้อง (ตัวเลขมากกว่า 0)"
      );
      return;
    }
    const namedExercises = exercises.filter((r) => r.name.trim());
    for (const r of namedExercises) {
      for (const s of r.sets) {
        const reps = Number(s.reps);
        if (!Number.isInteger(reps) || reps <= 0) {
          setError(`ท่า "${r.name.trim()}" ต้องกรอกจำนวนครั้งเป็นจำนวนเต็มมากกว่า 0 ทุกเซ็ท`);
          return;
        }
        if (s.rpe.trim()) {
          const setRpe = Number(s.rpe);
          if (!Number.isFinite(setRpe) || !Number.isInteger(setRpe * 2) || setRpe < 1 || setRpe > 10) {
            setError(`ท่า "${r.name.trim()}" มี RPE ที่ไม่ใช่จำนวนเต็มหรือครึ่ง (เช่น 7, 7.5) ระหว่าง 1-10`);
            return;
          }
        }
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
        avgCadence: avgCadence.trim() || undefined,
        maxSpeedMs: bestSpeedMs !== null ? bestSpeedMs : undefined,
        rpe: rpe.trim() || undefined,
        notes: notes.trim() || undefined,
        exercises: namedExercises.map((r) => ({
          name: r.name.trim(),
          sets: r.sets.map((s) => ({
            reps: Number(s.reps),
            weightKg: s.weightKg.trim() || undefined,
            rpe: s.rpe.trim() || undefined,
          })),
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
            placeholder={`ประเภท: วิ่ง\nระยะเวลา: 02:53:39\nระยะทาง: 5.2\nแคลอรี่: 350\nหัวใจเฉลี่ย: 130\nหัวใจสูงสุด: 165\nเคเดนซ์เฉลี่ย: 168\nระดับความเหนื่อย: 7\nหมายเหตุ: -`}
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
            <div>
              <label className={LABEL_CLASS}>เคเดนซ์เฉลี่ย (spm/rpm)</label>
              <input
                type="number"
                min="0"
                value={avgCadence}
                onChange={(e) => setAvgCadence(e.target.value)}
                placeholder="spm ถ้าวิ่ง/เดิน, rpm ถ้าปั่นจักรยาน"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{usesPace ? `เพซสูงสุด (ต่อ ${paceUnit === 1000 ? "กม." : "100 ม."})` : "ความเร็วสูงสุด (กม./ชม.)"}</label>
              {usesPace ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={bestPaceMin}
                    onChange={(e) => setBestPaceMin(e.target.value)}
                    placeholder="นาที"
                    className={INPUT_CLASS}
                  />
                  <span className="text-neutral-600">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={bestPaceSec}
                    onChange={(e) => setBestPaceSec(e.target.value)}
                    placeholder="วินาที"
                    className={INPUT_CLASS}
                  />
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={bestSpeedKmh}
                  onChange={(e) => setBestSpeedKmh(e.target.value)}
                  className={INPUT_CLASS}
                />
              )}
            </div>
            <div>
              <label className={LABEL_CLASS}>ระดับความเหนื่อย (RPE 1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                placeholder="เช่น 7 หรือ 7.5"
                className={INPUT_CLASS}
              />
              <RpeLevelsGuide title="แต่ละระดับหมายถึงอะไร?" levels={RPE_CARDIO_LEVELS} />
            </div>
          </div>
          <div className="mt-3">
            <label className={LABEL_CLASS}>หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ข้อมูลอื่นจากแอพนาฬิกาที่ไม่มีช่องกรอกเฉพาะ เช่น Training Effect, VO2max, โซนหัวใจ, กล้ามเนื้อที่ใช้"
              maxLength={500}
              rows={2}
              className={`${INPUT_CLASS} resize-y`}
            />
          </div>
        </div>

        <div className="border-t border-neutral-800 pt-4">
          <p className="mb-1 text-xs text-neutral-500">
            ท่าออกกำลังกาย (ไม่บังคับ) — สำหรับเวทเทรนนิ่ง/แคลิสเธนิกส์ ใส่ทีละท่าพร้อมเซ็ท/ครั้ง/น้ำหนักที่ใช้
          </p>
          <div className="mb-3">
            <RpeLevelsGuide title="RPE ของแต่ละเซ็ทหมายถึงอะไร?" levels={RPE_LIFT_LEVELS} />
          </div>
          {/* Only offered while the list is still empty — repeating an
              entire previous session only makes sense as a starting point,
              not something that should ever silently clobber rows the
              user already added by hand. */}
          {exercises.length === 0 && lastWorkoutSession && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-neutral-800/50 px-3 py-2 text-xs text-neutral-400">
              <span>
                ทำซ้ำทั้งวันจากครั้งก่อน ({formatActivityDate(new Date(lastWorkoutSession.startedAtMs))}) —{" "}
                {lastWorkoutSession.exercises.length} ท่า
              </span>
              <button
                type="button"
                onClick={useLastWorkout}
                className="flex-none rounded border border-neutral-700 px-2 py-1 font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
              >
                ใช้ค่านี้
              </button>
            </div>
          )}
          {exercises.length > 0 && (
            <div className="mb-2 space-y-2">
              {exercises.map((r) => {
                const match = statsByName.get(r.name.trim().toLowerCase());
                return (
                <div key={r.id} className="rounded-lg border border-neutral-800 p-2.5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <input
                      value={r.name}
                      onChange={(e) => updateExercise(r.id, { name: e.target.value })}
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
                        ครั้งก่อน ({formatActivityDate(new Date(match.latestAtMs))}): {formatSetsCompact(match.latestSets)}
                      </span>
                      <button
                        type="button"
                        onClick={() => useLastTime(r.id, match)}
                        className="flex-none rounded border border-neutral-700 px-1.5 py-0.5 font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
                      >
                        ใช้ค่านี้
                      </button>
                    </div>
                  )}
                  {/* One row per set — reps/weight/RPE are independent per
                      set (not one value applied to all of them), so a
                      pyramid/drop set can be entered exactly as performed.
                      RPE here is reps-in-reserve framing (10 = 0 reps left)
                      — see ExerciseSet.rpe's schema comment. */}
                  <div className="mb-1 grid grid-cols-[1.5rem_1fr_1fr_2.75rem_1.25rem] gap-1 px-0.5">
                    <span className="text-center text-[10px] text-neutral-600">เซ็ท</span>
                    <span className="text-center text-[10px] text-neutral-600">ครั้ง</span>
                    <span className="text-center text-[10px] text-neutral-600">น้ำหนัก (กก.)</span>
                    <span className="text-center text-[10px] text-neutral-600">RPE</span>
                    <span />
                  </div>
                  <div className="space-y-1.5">
                    {r.sets.map((s, i) => (
                      <div key={s.id} className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem_1.25rem] items-center gap-1">
                        <span className="text-center text-xs text-neutral-500">{i + 1}</span>
                        <input
                          type="number"
                          min="1"
                          value={s.reps}
                          onChange={(e) => updateSetRow(r.id, s.id, { reps: e.target.value })}
                          className={INPUT_CLASS}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={s.weightKg}
                          onChange={(e) => updateSetRow(r.id, s.id, { weightKg: e.target.value })}
                          placeholder="ไม่มี"
                          className={INPUT_CLASS}
                        />
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.5"
                          value={s.rpe}
                          onChange={(e) => updateSetRow(r.id, s.id, { rpe: e.target.value })}
                          placeholder="-"
                          title="RPE (เหลือแรงยกได้อีกกี่ที — 10 = ยกไม่ไหวแล้ว)"
                          className={`${INPUT_CLASS} px-1.5`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSetRow(r.id, s.id)}
                          disabled={r.sets.length <= 1}
                          title="ลบเซ็ทนี้"
                          className="flex-none text-neutral-600 hover:text-red-400 disabled:opacity-30"
                        >
                          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addSetRow(r.id)}
                    className="mt-2 text-[11px] font-medium text-neutral-400 transition hover:text-neutral-200"
                  >
                    + เพิ่มเซ็ท
                  </button>
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
