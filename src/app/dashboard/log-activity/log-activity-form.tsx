"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { parseActivityText } from "@/lib/activity-import-parse";
import { LOGGABLE_ACTIVITY_TYPES } from "@/lib/activity-types";
import { estimateCalories, type Intensity } from "@/lib/calorie-estimate";
import type { ExerciseStat, WorkoutSession } from "@/lib/exercise-stats";
import { formatActivityDate, type FormatLang } from "@/lib/format";

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";
const LABEL_CLASS = "mb-1 block text-xs text-neutral-500";

// Whole-session RPE — Borg/talk-test framing (how hard is it to breathe/
// talk right now), same scale most watch apps show. A `title` tooltip
// alone doesn't work on mobile (no hover), so RpeLevelsGuide below renders
// this as a tappable <details> reference next to the field instead. Level
// definitions live in messages/{th,en}.json's logActivity.rpeCardioLevels
// (read via t.raw() inside the component, below) and
// logActivity.rpeLiftLevels for the per-set reps-in-reserve scale (see
// ExerciseSet.rpe's schema comment).
type RpeLevel = { level: string; label: string; desc: string };

function RpeLevelsGuide({ title, levels }: { title: string; levels: RpeLevel[] }) {
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
เพซที่ดีที่สุด: [นาที:วินาที ต่อกม. ถ้าวิ่ง, นาที:วินาที ต่อ 100ม. ถ้าว่ายน้ำ, หรือกม./ชม. ถ้ากิจกรรมอื่น — อ่านจาก "เพซดีที่สุด"/"Best Pace"/"Max Speed" ในรูป]
ระดับความเหนื่อย: [RPE 1-10 ถ้ารูปมีบอกไว้]
หมายเหตุ: [สรุปข้อมูลอื่นที่มีในรูปแต่ไม่ตรงกับหัวข้อด้านบนเป็นประโยคสั้นๆ บรรทัดเดียว เช่น Training Effect, VO2max, โซนหัวใจ, กล้ามเนื้อที่ใช้ — ถ้าไม่มีข้อมูลอื่นเหลือให้ใส่ "-"]

ถ้าเป็นเวทเทรนนิ่ง ให้ใส่รายการท่าต่อท้ายด้วย หนึ่งบรรทัดต่อหนึ่งเซ็ทที่ทำจริง (ถ้าท่าเดียวกันทำหลายเซ็ทที่ตัวเลขต่างกัน ให้แยกคนละบรรทัด อย่ารวมเป็นค่าเดียว) รูปแบบ "ชื่อท่า | เซ็ทที่ | ครั้ง | น้ำหนัก(กก.) | RPE | หมายเหตุ" (คอลัมน์ RPE ใส่แค่ถ้ารูปบอกไว้ ไม่งั้นเว้นว่าง — ถ้ารูปไม่ได้บอกน้ำหนักที่ยกไว้เลย เช่นนาฬิกาที่นับได้แค่จำนวนครั้งจากการเคลื่อนไหว ให้เว้นคอลัมน์น้ำหนักว่างไว้เช่นกัน — คอลัมน์หมายเหตุใส่แค่ถ้ารูปมีข้อความจดไว้สำหรับท่านั้นจริง ๆ เช่นภาพถ่ายสมุดบันทึกที่เขียนความรู้สึก/สิ่งที่ควรปรับไว้เอง ไม่ต้องเดาเติมเอง ใส่ที่แถวไหนของท่านั้นก็ได้แถวเดียวพอ ไม่ต้องซ้ำทุกแถว):
ท่า:
ดันไหล่ดัมเบล | 1 | 15 | 5 | 8 |
ดันไหล่ดัมเบล | 2 | 14 | 5 | 8 |
ดันไหล่ดัมเบล | 3 | 10 | 4 | 9 | รอบหน้าเพิ่มน้ำหนัก`;

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
  // Free-text reflection on this exercise specifically (how it felt, what
  // to adjust next time) — see Exercise.notes's schema comment. Deliberately
  // never prefilled from history (useLastTime/useWorkoutSession below both
  // leave it untouched/empty) since it's this session's own take, not a
  // template to repeat.
  notes: string;
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
  return { id: nextRowId++, name: "", sets: [emptySetRow(), emptySetRow(), emptySetRow()], notes: "" };
}

// Turns a set-history shape (ExerciseSetSummary from exercise-stats.ts, or
// the equivalent per-set entries on a WorkoutSession) into editable
// SetRows with fresh ids — shared by useLastTime (one exercise) and
// useWorkoutSession (a whole session) below so the two "prefill from
// history" paths can't drift apart on how a set turns into form state.
function toSetRows(sets: { reps: number; weightKg: number | null; rpe: number | null }[]): SetRow[] {
  return sets.map((s) => ({
    id: nextRowId++,
    reps: String(s.reps),
    weightKg: s.weightKg !== null ? String(s.weightKg) : "",
    rpe: s.rpe !== null ? String(s.rpe) : "",
  }));
}

// Compact "15×5kg (RPE 8), 14×5kg (RPE 8), 10×4kg (RPE 9)" summary for the
// "previous session" hint — bodyweight sets (weightKg null) show as just
// "N reps" with no "×weight", and a set logged without RPE just omits that
// part. Takes the translator function itself (not a lang code) since it's a
// plain helper, not a hook — safe to pass the value a hook already returned.
function formatSetsCompact(
  sets: { reps: number; weightKg: number | null; rpe: number | null }[],
  t: ReturnType<typeof useTranslations>
): string {
  return sets
    .map((s) => {
      const base =
        s.weightKg !== null
          ? t("compactSetWithWeight", { reps: s.reps, weight: s.weightKg })
          : t("compactSetNoWeight", { reps: s.reps });
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
  exercises: { name: string; notes: string; sets: { reps: string; weightKg: string; rpe: string }[] }[];
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
  recentWorkoutSessions = [],
  userWeightKg = null,
}: {
  activityId?: string;
  initial?: LogActivityInitial;
  exerciseStats?: ExerciseStat[];
  recentWorkoutSessions?: WorkoutSession[];
  userWeightKg?: number | null;
}) {
  const router = useRouter();
  const t = useTranslations("logActivity");
  const locale = useLocale();
  const lang: FormatLang = locale === "en" ? "en" : "th";
  const TYPES = LOGGABLE_ACTIVITY_TYPES.map((value) => ({ value, label: t(`type${value}`) }));
  const INTENSITIES = [
    { value: "LOW", label: t("intensityLow") },
    { value: "MODERATE", label: t("intensityModerate") },
    { value: "HIGH", label: t("intensityHigh") },
  ];
  const RPE_CARDIO_LEVELS = t.raw("rpeCardioLevels") as RpeLevel[];
  const RPE_LIFT_LEVELS = t.raw("rpeLiftLevels") as RpeLevel[];
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
  // Round the total seconds once, up front, then derive min/sec from that
  // single integer — rounding them separately (as this used to) lets sec
  // round up to 60 without carrying into min, prefilling the edit form
  // with an invalid pace like "5 min 60 sec" (same bug class fixed in
  // src/lib/format.ts's formatPace).
  const initialBestPaceTotalSec =
    initialMaxSpeedMs && initialPaceUnit ? Math.round(initialPaceUnit / initialMaxSpeedMs) : null;
  const [bestPaceMin, setBestPaceMin] = useState(() => {
    if (initialBestPaceTotalSec === null) return "";
    return String(Math.floor(initialBestPaceTotalSec / 60));
  });
  const [bestPaceSec, setBestPaceSec] = useState(() => {
    if (initialBestPaceTotalSec === null) return "";
    return String(initialBestPaceTotalSec % 60);
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
        notes: e.notes,
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
      setImportNotice(t("copyFailed"));
    }
  }

  function applyParsedText() {
    const parsed = parseActivityText(pasteText);
    if (parsed.type && TYPES.some((opt) => opt.value === parsed.type)) setType(parsed.type);
    if (parsed.durationMin !== null) setDurationMin(String(parsed.durationMin));
    if (parsed.distanceKm !== null) setDistanceKm(String(parsed.distanceKm));
    if (parsed.calories !== null) setCalories(String(parsed.calories));
    if (parsed.avgHeartRate !== null) setAvgHeartRate(String(parsed.avgHeartRate));
    if (parsed.maxHeartRate !== null) setMaxHeartRate(String(parsed.maxHeartRate));
    if (parsed.avgCadence !== null) setAvgCadence(String(parsed.avgCadence));
    if (parsed.maxSpeedMs !== null) {
      // parseActivityText already converted this to m/s using whatever
      // type it read off the same text — re-derive which fields to fill
      // from the type that's about to actually be in effect (the just-
      // parsed one if valid, else whatever's already selected), not the
      // component's `usesPace`/`paceUnit` above, which still reflect the
      // *pre-setType* render and would be stale the moment parsed.type
      // differs from what's currently selected.
      const effectiveType = parsed.type && TYPES.some((opt) => opt.value === parsed.type) ? parsed.type : type;
      const effectivePaceUnit = paceUnitMeters(effectiveType);
      if (effectivePaceUnit !== null) {
        // Round total seconds first, then derive min/sec from that one
        // integer — see initialBestPaceTotalSec's comment above.
        const totalSec = Math.round(effectivePaceUnit / parsed.maxSpeedMs);
        setBestPaceMin(String(Math.floor(totalSec / 60)));
        setBestPaceSec(String(totalSec % 60));
      } else {
        setBestSpeedKmh(String(Math.round(parsed.maxSpeedMs * 3.6 * 10) / 10));
      }
    }
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
          notes: e.notes ?? "",
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
      parsed.maxSpeedMs !== null ||
      parsed.rpe !== null ||
      parsed.notes !== null ||
      parsed.exercises.length > 0;
    if (!gotAnything) {
      setImportNotice(t("importNoData"));
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

  // Prefills every exercise and every set from a picked previous session in
  // one tap, instead of adding each exercise row by hand and then hitting
  // "ใช้ค่านี้" once per row — worth it for anyone whose routine repeats
  // close to the same exercises/sets from one session to the next (a
  // pattern the request that prompted this feature showed clearly). Offers
  // the last few sessions rather than only the single most recent one,
  // since a routine that alternates (e.g. upper/lower split) means "last
  // time" isn't always the right day to repeat — only shown while the
  // exercise list is still empty (see the picker's own guard below), same
  // "confirm before applying, never silently overwrite in-progress input"
  // rule as useLastTime above.
  function useWorkoutSession(session: WorkoutSession) {
    // Notes deliberately left blank (not copied from the repeated session)
    // — see ExerciseRow's comment on why.
    setExercises(session.exercises.map((ex) => ({ id: nextRowId++, name: ex.name, notes: "", sets: toSetRows(ex.sets) })));
  }

  async function save() {
    if (!Number.isFinite(Number(durationMin)) || Number(durationMin) <= 0) {
      setError(t("errorDuration"));
      return;
    }
    if (rpe.trim()) {
      const n = Number(rpe);
      if (!Number.isFinite(n) || !Number.isInteger(n * 2) || n < 1 || n > 10) {
        setError(t("errorRpe"));
        return;
      }
    }
    const bestSpeedMs = computeBestSpeedMs();
    if (Number.isNaN(bestSpeedMs)) {
      setError(usesPace ? t("errorPace") : t("errorSpeed"));
      return;
    }
    const namedExercises = exercises.filter((r) => r.name.trim());
    for (const r of namedExercises) {
      for (const s of r.sets) {
        const reps = Number(s.reps);
        if (!Number.isInteger(reps) || reps <= 0) {
          setError(t("errorExerciseReps", { name: r.name.trim() }));
          return;
        }
        if (s.rpe.trim()) {
          const setRpe = Number(s.rpe);
          if (!Number.isFinite(setRpe) || !Number.isInteger(setRpe * 2) || setRpe < 1 || setRpe > 10) {
            setError(t("errorExerciseRpe", { name: r.name.trim() }));
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
          notes: r.notes.trim() || undefined,
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
      setError(t("errorSaveFailed"));
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
          {t("modeManual")}
        </button>
        <button
          onClick={() => setMode("import")}
          className={`rounded-md px-2.5 py-1 font-medium transition ${
            mode === "import" ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {t("modeImport")}
        </button>
      </div>

      {mode === "import" && (
        <div className="space-y-2">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
            <p className="text-xs text-neutral-400">{t("importStep1")}</p>
            <button
              type="button"
              onClick={copyPrompt}
              className="mt-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
            >
              {copied ? t("copied") : t("copyPrompt")}
            </button>
            <p className="mt-2 text-xs text-neutral-400">{t("importStep2")}</p>
          </div>
          {/* This placeholder mirrors the exact Thai field-name format
              AI_PROMPT_TEMPLATE asks for and parseActivityText expects back
              (see its own comment) — stays Thai-only regardless of UI
              language, same as every other AI-import prompt in the app
              (see CLAUDE.md's "### 5. ภาษา (i18n)"). */}
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`ประเภท: วิ่ง\nระยะเวลา: 02:53:39\nระยะทาง: 5.2\nแคลอรี่: 350\nหัวใจเฉลี่ย: 130\nหัวใจสูงสุด: 165\nเคเดนซ์เฉลี่ย: 168\nเพซที่ดีที่สุด: 5:30\nระดับความเหนื่อย: 7\nหมายเหตุ: -`}
            rows={7}
            className={`${INPUT_CLASS} resize-y font-mono text-xs`}
          />
          {importNotice && <p className="text-xs text-amber-400">{importNotice}</p>}
          <button
            onClick={applyParsedText}
            disabled={!pasteText.trim()}
            className="rounded-lg bg-[#fc4c02] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
          >
            {t("applyImport")}
          </button>
        </div>
      )}

      {mode === "manual" && (
        <>
        <div>
          <label className={LABEL_CLASS}>{t("labelType")}</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLASS}>
            {TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>{t("labelName")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className={INPUT_CLASS} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>{t("labelDuration")}</label>
            <input
              type="number"
              min="1"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>{t("labelIntensity")}</label>
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
          <label className={LABEL_CLASS}>{t("labelStartedAt")}</label>
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="border-t border-neutral-800 pt-4">
          <p className="mb-3 text-xs text-neutral-500">{t("moreInfoHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>{t("labelDistance")}</label>
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
              <label className={LABEL_CLASS}>{t("labelCalories")}</label>
              <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} className={INPUT_CLASS} />
              {!calories.trim() && estimatedCalories !== null && (
                <button
                  type="button"
                  onClick={() => setCalories(String(estimatedCalories))}
                  className="mt-1 text-left text-[11px] text-neutral-500 underline decoration-dotted transition hover:text-neutral-300"
                >
                  {t("estimatedCalories", { value: estimatedCalories })}
                </button>
              )}
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("labelAvgHr")}</label>
              <input
                type="number"
                min="0"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("labelMaxHr")}</label>
              <input
                type="number"
                min="0"
                value={maxHeartRate}
                onChange={(e) => setMaxHeartRate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("labelCadence")}</label>
              <input
                type="number"
                min="0"
                value={avgCadence}
                onChange={(e) => setAvgCadence(e.target.value)}
                placeholder={t("cadencePlaceholder")}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                {usesPace ? t("labelBestPace", { unit: paceUnit === 1000 ? t("unitKm") : t("unit100m") }) : t("labelBestSpeed")}
              </label>
              {usesPace ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={bestPaceMin}
                    onChange={(e) => setBestPaceMin(e.target.value)}
                    placeholder={t("minutePlaceholder")}
                    className={INPUT_CLASS}
                  />
                  <span className="text-neutral-600">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={bestPaceSec}
                    onChange={(e) => setBestPaceSec(e.target.value)}
                    placeholder={t("secondPlaceholder")}
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
              <label className={LABEL_CLASS}>{t("labelRpe")}</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                placeholder={t("rpePlaceholder")}
                className={INPUT_CLASS}
              />
              <RpeLevelsGuide title={t("rpeGuideTitle")} levels={RPE_CARDIO_LEVELS} />
            </div>
          </div>
          <div className="mt-3">
            <label className={LABEL_CLASS}>{t("labelNotes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              maxLength={500}
              rows={2}
              className={`${INPUT_CLASS} resize-y`}
            />
          </div>
        </div>

        <div className="border-t border-neutral-800 pt-4">
          <p className="mb-1 text-xs text-neutral-500">{t("exercisesHint")}</p>
          <div className="mb-3">
            <RpeLevelsGuide title={t("setRpeGuideTitle")} levels={RPE_LIFT_LEVELS} />
          </div>
          {/* Only offered while the list is still empty — repeating an
              entire previous session only makes sense as a starting point,
              not something that should ever silently clobber rows the
              user already added by hand. Lists the last few sessions (not
              just the single most recent one) so a routine that alternates
              day to day can still be repeated from the right day. */}
          {exercises.length === 0 && recentWorkoutSessions.length > 0 && (
            <div className="mb-3 rounded-lg bg-neutral-800/50 px-3 py-2">
              <p className="mb-1.5 text-xs font-medium text-neutral-400">{t("repeatDayTitle")}</p>
              <div className="space-y-1.5">
                {recentWorkoutSessions.map((session) => (
                  <div key={session.activityId} className="flex items-center justify-between gap-2 text-xs text-neutral-400">
                    <span>
                      {t("repeatDayLabel", {
                        date: formatActivityDate(new Date(session.startedAtMs), lang),
                        count: session.exercises.length,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => useWorkoutSession(session)}
                      className="flex-none rounded border border-neutral-700 px-2 py-1 font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
                    >
                      {t("useThis")}
                    </button>
                  </div>
                ))}
              </div>
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
                      placeholder={t("exerciseNamePlaceholder")}
                      list="exercise-name-history"
                      className={`${INPUT_CLASS} flex-1`}
                    />
                    <button
                      onClick={() => removeExerciseRow(r.id)}
                      title={t("removeExercise")}
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
                        {t("previousLabel", {
                          date: formatActivityDate(new Date(match.latestAtMs), lang),
                          sets: formatSetsCompact(match.latestSets, t),
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => useLastTime(r.id, match)}
                        className="flex-none rounded border border-neutral-700 px-1.5 py-0.5 font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
                      >
                        {t("useThis")}
                      </button>
                    </div>
                  )}
                  {/* One row per set — reps/weight/RPE are independent per
                      set (not one value applied to all of them), so a
                      pyramid/drop set can be entered exactly as performed.
                      RPE here is reps-in-reserve framing (10 = 0 reps left)
                      — see ExerciseSet.rpe's schema comment. */}
                  <div className="mb-1 grid grid-cols-[1.5rem_1fr_1fr_2.75rem_1.25rem] gap-1 px-0.5">
                    <span className="text-center text-[10px] text-neutral-600">{t("colSet")}</span>
                    <span className="text-center text-[10px] text-neutral-600">{t("colReps")}</span>
                    <span className="text-center text-[10px] text-neutral-600">{t("colWeight")}</span>
                    <span className="text-center text-[10px] text-neutral-600">{t("colRpe")}</span>
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
                          placeholder={t("weightPlaceholder")}
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
                          title={t("rpeCellTitle")}
                          className={`${INPUT_CLASS} px-1.5`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSetRow(r.id, s.id)}
                          disabled={r.sets.length <= 1}
                          title={t("removeSet")}
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
                    {t("addSet")}
                  </button>
                  <div className="mt-2">
                    <textarea
                      value={r.notes}
                      onChange={(e) => updateExercise(r.id, { notes: e.target.value })}
                      placeholder={t("exerciseNotesPlaceholder")}
                      maxLength={500}
                      rows={1}
                      className={`${INPUT_CLASS} resize-y text-xs`}
                    />
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
            {t("addExercise")}
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
        >
          {saving ? t("saving") : activityId ? t("saveEdit") : t("saveNew")}
        </button>
        </>
      )}
    </div>
  );
}
