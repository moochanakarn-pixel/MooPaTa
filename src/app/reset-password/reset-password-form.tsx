"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const INPUT_CLASS =
  "w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      if (res.ok) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      setError(data.error === "invalid_password" ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" : "ลิงก์นี้หมดอายุหรือใช้ไปแล้ว ลองขอลิงก์ใหม่");
    } catch {
      setError("มีปัญหาบางอย่าง ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <p className="text-neutral-400">ลิงก์นี้ไม่ถูกต้อง ลองขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้งจากหน้าแรก</p>;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-xl font-bold">ตั้งรหัสผ่านใหม่</h1>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
        className={INPUT_CLASS}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting || !newPassword}
        className="rounded-xl bg-neutral-100 px-4 py-3 font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
      </button>
    </div>
  );
}
