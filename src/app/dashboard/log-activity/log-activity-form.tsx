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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!Number.isFinite(Number(durationMin)) || Number(durationMin) <= 0) {
      setError("กรอกระยะเวลาให้ถูกต้องก่อน");
      return;
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
          ข้อมูลเพิ่มเติม (ไม่บังคับ) — คัดลอกจากแอพนาฬิกา/สายรัดที่บันทึกไว้ได้ เช่น Huawei Health
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
