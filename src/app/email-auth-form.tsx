"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup" | "forgot";

const INPUT_CLASS =
  "w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

// The fallback login path alongside "เข้าสู่ระบบด้วย Google" above it on
// the landing page, for anyone who'd rather not use a Google account.
export function EmailAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function submit() {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (res.ok) {
          router.push("/dashboard");
          return;
        }
        if (data.error === "email_not_verified") setError("ยังไม่ได้ยืนยันอีเมล เช็คกล่องจดหมายก่อนเข้าสู่ระบบ");
        else if (data.error === "account_locked") setError("ลองรหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง");
        else setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
        } else if (data.error === "email_taken") {
          setError("อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน");
        } else if (data.error === "invalid_password") {
          setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        } else {
          setError("อีเมลไม่ถูกต้อง");
        }
      } else {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setMessage(data.message);
      }
    } catch {
      setError("มีปัญหาบางอย่าง ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5 text-left">
      <div className="mb-4 flex gap-2 text-sm">
        <button
          onClick={() => switchMode("login")}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${mode === "login" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
        >
          เข้าสู่ระบบ
        </button>
        <button
          onClick={() => switchMode("signup")}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${mode === "signup" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
        >
          สมัครสมาชิก
        </button>
      </div>

      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="อีเมล"
          className={INPUT_CLASS}
        />
        {mode !== "forgot" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน"
            className={INPUT_CLASS}
          />
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <button
          onClick={submit}
          disabled={submitting || !email || (mode !== "forgot" && !password)}
          className="w-full rounded-xl bg-neutral-100 px-4 py-3 font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-50"
        >
          {submitting ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : mode === "signup" ? "สมัครสมาชิก" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
        </button>

        {mode === "login" && (
          <button onClick={() => switchMode("forgot")} className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300">
            ลืมรหัสผ่าน
          </button>
        )}
        {mode === "forgot" && (
          <button onClick={() => switchMode("login")} className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300">
            กลับไปเข้าสู่ระบบ
          </button>
        )}
      </div>
    </div>
  );
}
