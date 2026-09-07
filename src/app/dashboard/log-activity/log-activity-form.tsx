"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export function LogActivityForm() {
  const router = useRouter();
  const [type, setType] = useState("Football");
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [intensity, setIntensity] = useState("MODERATE");
  const [startedAt, setStartedAt] = useState(() => toDatetimeLocal(new Date()));
  const [distanceKm, setDistanceKm] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [maxHeartRate, setMaxHeartRate] = useState("");
  const [calories, setCalories] = useState("");
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const res = await fetch("/api/activity/manual", {
      method: "POST",
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
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
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
            {exercises.map((r) => (
              <div key={r.id} className="flex items-center gap-1.5">
                <input
                  value={r.name}
                  onChange={(e) => updateExerciseRow(r.id, { name: e.target.value })}
                  placeholder="ชื่อท่า เช่น ดันไหล่ดัมเบล"
                  className={`${INPUT_CLASS} flex-1`}
                />
                <input
                  type="number"
                  min="1"
                  value={r.sets}
                  onChange={(e) => updateExerciseRow(r.id, { sets: e.target.value })}
                  placeholder="เซ็ท"
                  title="จำนวนเซ็ท"
                  className={`${INPUT_CLASS} w-16`}
                />
                <input
                  type="number"
                  min="1"
                  value={r.reps}
                  onChange={(e) => updateExerciseRow(r.id, { reps: e.target.value })}
                  placeholder="ครั้ง"
                  title="จำนวนครั้งต่อเซ็ท"
                  className={`${INPUT_CLASS} w-16`}
                />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={r.weightKg}
                  onChange={(e) => updateExerciseRow(r.id, { weightKg: e.target.value })}
                  placeholder="กก."
                  title="น้ำหนักที่ใช้ (กก.) — เว้นว่างได้ถ้าไม่มี"
                  className={`${INPUT_CLASS} w-16`}
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
            ))}
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
        {saving ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
      </button>
    </div>
  );
}
