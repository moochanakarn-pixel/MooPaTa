"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

// Masks everything before the last 2 characters of the local part, e.g.
// "sm***th@gmail.com" — just enough to recognize your own address without
// showing it in full on a screen someone else might glance at.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return email;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

export function SetPasswordForm({ currentEmail, verified }: { currentEmail: string | null; verified: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(!currentEmail);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setPassword("");
        router.refresh();
      } else if (data.error === "email_taken") {
        setError("อีเมลนี้มีบัญชีอื่นใช้อยู่แล้ว");
      } else if (data.error === "invalid_password") {
        setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      } else {
        setError("อีเมลไม่ถูกต้อง");
      }
    } catch {
      setError("มีปัญหาบางอย่าง ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {currentEmail && (
        <p className="mb-3 text-sm text-neutral-400">
          {maskEmail(currentEmail)} —{" "}
          {verified ? <span className="text-emerald-400">ยืนยันแล้ว</span> : <span className="text-amber-400">ยังไม่ได้ยืนยัน เช็คอีเมล</span>}
        </p>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="text-xs text-neutral-500 hover:text-neutral-300">
          เปลี่ยนอีเมล/รหัสผ่าน
        </button>
      ) : (
        <div className="space-y-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" className={INPUT_CLASS} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
            className={INPUT_CLASS}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          {message && <p className="text-xs text-emerald-400">{message}</p>}
          <button
            onClick={save}
            disabled={saving || !email || !password}
            className="rounded-lg bg-lime-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-lime-500 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      )}
    </div>
  );
}
