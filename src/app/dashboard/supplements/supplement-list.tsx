"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SupplementItem {
  id: string;
  name: string;
  timeLabel: string | null;
  note: string | null;
  takenToday: boolean;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

function SupplementRow({ item, onToggle, onDelete }: { item: SupplementItem; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
      <button
        onClick={onToggle}
        className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border transition ${
          item.takenToday ? "border-emerald-600 bg-emerald-600/20 text-emerald-400" : "border-neutral-700 text-transparent"
        }`}
        title={item.takenToday ? "กินแล้ววันนี้" : "ยังไม่ได้กิน"}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
          <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${item.takenToday ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
          {item.name}
          {item.timeLabel && <span className="ml-2 text-xs font-normal text-neutral-500">· {item.timeLabel}</span>}
        </p>
        {item.note && <p className="mt-0.5 text-xs text-neutral-600">{item.note}</p>}
      </div>
      <button onClick={onDelete} className="flex-none text-neutral-600 hover:text-red-400" title="ลบ">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function SupplementList({ items }: { items: SupplementItem[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [timeLabel, setTimeLabel] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    await fetch(`/api/supplements/${id}/toggle`, { method: "POST" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("ลบรายการอาหารเสริมนี้?")) return;
    await fetch(`/api/supplements/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function add() {
    if (!name.trim()) {
      setError("กรอกชื่ออาหารเสริมก่อน");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await fetch("/api/supplements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), timeLabel: timeLabel.trim() || null, note: note.trim() || null }),
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setTimeLabel("");
      setNote("");
      setShowAdd(false);
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div>
      {items.length === 0 && !showAdd ? (
        <p className="py-8 text-center text-sm text-neutral-600">ยังไม่มีรายการอาหารเสริม</p>
      ) : (
        <div className="mb-4 space-y-2">
          {items.map((item) => (
            <SupplementRow key={item.id} item={item} onToggle={() => toggle(item.id)} onDelete={() => remove(item.id)} />
          ))}
        </div>
      )}

      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          เพิ่มอาหารเสริม
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ เช่น Biotin Zinc+" className={INPUT_CLASS} />
          <input
            value={timeLabel}
            onChange={(e) => setTimeLabel(e.target.value)}
            placeholder="เวลาที่ควรกิน (ไม่บังคับ) เช่น เช้า, ก่อนนอน"
            className={INPUT_CLASS}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ (ไม่บังคับ) เช่น กินพร้อมมื้ออาหาร ไม่กินพร้อมแคลเซียม"
            className={INPUT_CLASS}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={add}
              disabled={saving}
              className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setError(null);
              }}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
