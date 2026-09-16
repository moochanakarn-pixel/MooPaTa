"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("settings.setPasswordForm");
  const router = useRouter();
  const [showForm, setShowForm] = useState(!currentEmail);
  // Pre-filled with the existing (verified or not) email — otherwise
  // someone who just wants to change their password has to retype it from
  // memory, and a typo there silently changes their account's login email
  // instead of just its password.
  const [email, setEmail] = useState(currentEmail ?? "");
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
        setError(t("emailTaken"));
      } else if (data.error === "invalid_password") {
        setError(t("invalidPassword"));
      } else {
        setError(t("invalidEmail"));
      }
    } catch {
      setError(t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {currentEmail && (
        <p className="mb-3 text-sm text-neutral-400">
          {maskEmail(currentEmail)} —{" "}
          {verified ? <span className="text-emerald-400">{t("verified")}</span> : <span className="text-amber-400">{t("notVerified")}</span>}
        </p>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="text-xs text-neutral-500 hover:text-neutral-300">
          {t("changeButton")}
        </button>
      ) : (
        <div className="space-y-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} className={INPUT_CLASS} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            className={INPUT_CLASS}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          {message && <p className="text-xs text-emerald-400">{message}</p>}
          <button
            onClick={save}
            disabled={saving || !email || !password}
            className="rounded-lg bg-lime-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-lime-500 disabled:opacity-50"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      )}
    </div>
  );
}
