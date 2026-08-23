"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UnitSystem } from "@/lib/format";

export function UnitToggle({ initial }: { initial: UnitSystem }) {
  const router = useRouter();
  const [unit, setUnit] = useState<UnitSystem>(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: UnitSystem) {
    if (next === unit) return;
    setUnit(next);
    setSaving(true);
    await fetch("/api/settings/unit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
      {(["METRIC", "IMPERIAL"] as const).map((option) => (
        <button
          key={option}
          onClick={() => change(option)}
          disabled={saving}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            unit === option ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {option === "METRIC" ? "กม. (Metric)" : "ไมล์ (Imperial)"}
        </button>
      ))}
    </div>
  );
}

export function DisconnectStravaButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm("ยกเลิกการเชื่อมต่อ Strava? ข้อมูลเก่าที่ซิงค์ไว้แล้วจะยังอยู่ แต่จะไม่มีการซิงค์ใหม่อีก")) return;
    setPending(true);
    const res = await fetch("/api/settings/disconnect-strava", { method: "POST" });
    setPending(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:opacity-50"
    >
      {pending ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อมต่อ Strava"}
    </button>
  );
}

export function DeleteAccountButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        "ลบบัญชีถาวร? ข้อมูล activity ทั้งหมดของคุณใน MooPaTa จะถูกลบและกู้คืนไม่ได้ (การเชื่อมต่อ Strava จะถูกยกเลิกด้วย)"
      )
    )
      return;
    setPending(true);
    const res = await fetch("/api/settings/delete-account", { method: "POST" });
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    setPending(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-800 hover:bg-red-950/50 disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "ลบบัญชีถาวร"}
    </button>
  );
}
