"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

export interface WaterReminderSchedule {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  intervalMin: number;
}

const INTERVAL_PRESETS = [30, 45, 60, 90, 120];

// Web Push subscriptions use a raw byte array for the VAPID public key, but
// it's handed out as a URL-safe base64 string — this is the standard
// conversion boilerplate for that.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function timesPerDay(schedule: WaterReminderSchedule): number {
  const [sh, sm] = schedule.start.split(":").map(Number);
  const [eh, em] = schedule.end.split(":").map(Number);
  const spanMin = eh * 60 + em - (sh * 60 + sm);
  if (spanMin <= 0 || schedule.intervalMin <= 0) return 0;
  return Math.floor(spanMin / schedule.intervalMin) + 1;
}

// Lets the user opt in/out of the water-intake reminder push notifications
// (sent by the /api/cron/water-reminder scheduled task) for this specific
// browser/device, and configure the window/frequency those reminders use
// (shared across the user's devices — stored on the User row, not per
// subscription).
export function WaterReminderToggle({ initialSchedule }: { initialSchedule: WaterReminderSchedule }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [schedule, setSchedule] = useState(initialSchedule);
  const [draft, setDraft] = useState(initialSchedule);
  const [customInterval, setCustomInterval] = useState(
    INTERVAL_PRESETS.includes(initialSchedule.intervalMin) ? "" : String(initialSchedule.intervalMin)
  );
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    }
    check().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("ยังไม่ได้ตั้งค่าระบบแจ้งเตือนบนเซิร์ฟเวอร์");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe_failed");
      setStatus("on");
    } catch (err) {
      console.error("Enable water reminders failed", err);
      setError("เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch (err) {
      console.error("Disable water reminders failed", err);
      setError("ปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    setScheduleError(null);
    setScheduleSaved(false);
    if (draft.start >= draft.end) {
      setScheduleError("เวลาเริ่มต้องมาก่อนเวลาเลิก");
      return;
    }
    if (!Number.isFinite(draft.intervalMin) || draft.intervalMin < 15 || draft.intervalMin > 240) {
      setScheduleError("ความถี่ต้องอยู่ระหว่าง 15-240 นาที");
      return;
    }
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/settings/water-reminder-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("save_failed");
      setSchedule(draft);
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2500);
    } catch (err) {
      console.error("Save water reminder schedule failed", err);
      setScheduleError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSavingSchedule(false);
    }
  }

  if (status === "checking") return null;
  if (status === "unsupported") return null;

  const scheduleDirty = draft.start !== schedule.start || draft.end !== schedule.end || draft.intervalMin !== schedule.intervalMin;
  const estimatedTimes = timesPerDay(draft);

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-400">แจ้งเตือนถ้าดื่มน้ำไม่ทันเป้า</p>
          {status === "denied" && (
            <p className="mt-0.5 text-[11px] text-amber-400">
              เคยปฏิเสธการแจ้งเตือนไว้ — เปิดสิทธิ์การแจ้งเตือนให้เว็บนี้ในตั้งค่าเบราว์เซอร์ก่อน
            </p>
          )}
          {error && <p className="mt-0.5 text-[11px] text-red-400">{error}</p>}
        </div>
        {status !== "denied" && (
          <button
            onClick={status === "on" ? disable : enable}
            disabled={busy}
            className={`flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              status === "on"
                ? "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                : "bg-cyan-600 text-white hover:bg-cyan-500"
            }`}
          >
            {busy ? "กำลังบันทึก..." : status === "on" ? "ปิดแจ้งเตือน" : "เปิดแจ้งเตือน"}
          </button>
        )}
      </div>

      {status === "on" && (
        <div className="mt-3 space-y-2.5 rounded-xl bg-neutral-900/60 p-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500">ตั้งแต่</span>
            <input
              type="time"
              value={draft.start}
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200 outline-none focus:ring-1 focus:ring-neutral-600"
            />
            <span className="text-neutral-500">ถึง</span>
            <input
              type="time"
              value={draft.end}
              onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200 outline-none focus:ring-1 focus:ring-neutral-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs text-neutral-500">ทุก</span>
            {INTERVAL_PRESETS.map((min) => (
              <button
                key={min}
                onClick={() => {
                  setCustomInterval("");
                  setDraft((d) => ({ ...d, intervalMin: min }));
                }}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  draft.intervalMin === min && !customInterval
                    ? "border-cyan-600 bg-cyan-600/20 text-cyan-300"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                }`}
              >
                {min} นาที
              </button>
            ))}
            <input
              type="number"
              min={15}
              max={240}
              value={customInterval}
              onChange={(e) => {
                const v = e.target.value;
                setCustomInterval(v);
                const n = Number(v);
                if (v && Number.isFinite(n)) setDraft((d) => ({ ...d, intervalMin: n }));
              }}
              placeholder="กำหนดเอง"
              className="w-20 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600"
            />
          </div>

          <p className="text-[11px] text-neutral-500">
            {estimatedTimes > 0
              ? `ประมาณ ${estimatedTimes} ครั้ง/วัน ทุก ${draft.intervalMin} นาที ตั้งแต่ ${draft.start} ถึง ${draft.end}`
              : "ช่วงเวลาไม่ถูกต้อง"}
          </p>

          {scheduleError && <p className="text-[11px] text-red-400">{scheduleError}</p>}
          {scheduleSaved && <p className="text-[11px] text-lime-400">บันทึกแล้ว</p>}

          {scheduleDirty && (
            <button
              onClick={saveSchedule}
              disabled={savingSchedule}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {savingSchedule ? "กำลังบันทึก..." : "บันทึกตารางเวลา"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
