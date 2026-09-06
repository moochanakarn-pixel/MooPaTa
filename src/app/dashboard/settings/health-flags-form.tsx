"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface HealthFlagsInitial {
  highCholesterol: boolean;
  highUricAcid: boolean;
}

function FlagToggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 transition hover:border-neutral-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-none accent-amber-500"
      />
      <span>
        <span className="block text-sm text-neutral-200">{label}</span>
        <span className="block text-xs text-neutral-500">{hint}</span>
      </span>
    </label>
  );
}

// Lets the user flag a couple of common blood-test findings from their own
// checkup — used only to surface rule-based dietary warnings on the food
// page (src/lib/health-flags.ts), never to diagnose anything.
export function HealthFlagsForm({ initial }: { initial: HealthFlagsInitial }) {
  const router = useRouter();
  const [highCholesterol, setHighCholesterol] = useState(initial.highCholesterol);
  const [highUricAcid, setHighUricAcid] = useState(initial.highUricAcid);
  const [saved, setSaved] = useState({ highCholesterol: initial.highCholesterol, highUricAcid: initial.highUricAcid });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = highCholesterol !== saved.highCholesterol || highUricAcid !== saved.highUricAcid;

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/health-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highCholesterol, highUricAcid }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved({ highCholesterol, highUricAcid });
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="space-y-2.5">
      <FlagToggle
        checked={highCholesterol}
        onChange={setHighCholesterol}
        label="คอเลสเตอรอล/LDL สูง"
        hint="แสดงยอดคอเลสเตอรอลที่กินวันนี้เทียบเพดาน 300 มก. ที่หน้าบันทึกอาหาร"
      />
      <FlagToggle
        checked={highUricAcid}
        onChange={setHighUricAcid}
        label="กรดยูริกสูง"
        hint="เตือนเมื่อบันทึกอาหารที่มีพิวรีนสูง เช่น เครื่องใน เนื้อแดง อาหารทะเลบางชนิด เบียร์"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      )}

      <p className="text-xs text-neutral-600">
        เป็นแค่การเตือนคร่าว ๆ ตามหลักการทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์ — ควรปรึกษาแพทย์ควบคู่ไปด้วย
      </p>
    </div>
  );
}
