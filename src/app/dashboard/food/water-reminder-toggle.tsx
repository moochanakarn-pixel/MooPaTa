"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

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

// Lets the user opt in/out of the water-intake reminder push notifications
// (sent by the /api/cron/water-reminder scheduled task) for this specific
// browser/device. Each device subscribes independently — there's no
// account-wide toggle, since a push subscription is inherently tied to one
// browser's service worker registration.
export function WaterReminderToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (status === "checking") return null;
  if (status === "unsupported") return null;

  return (
    <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-3">
      <div>
        <p className="text-xs text-neutral-400">แจ้งเตือนถ้าดื่มน้ำไม่ทันเป้าตอนบ่าย/เย็น</p>
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
  );
}
