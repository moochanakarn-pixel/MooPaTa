"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { UnitSystem } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

export function UnitToggle({ initial }: { initial: UnitSystem }) {
  const t = useTranslations("settings.unitToggle");
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
          {option === "METRIC" ? t("metric") : t("imperial")}
        </button>
      ))}
    </div>
  );
}

// Language names are shown in their own language (not translated) — same
// convention every OS/app language picker uses, so "English" always reads
// "English" and "ไทย" always reads "ไทย" regardless of the current UI
// language.
const LOCALE_LABELS: Record<AppLocale, string> = { th: "ไทย", en: "English" };

export function LocaleToggle({ initial }: { initial: AppLocale }) {
  const router = useRouter();
  const [locale, setLocale] = useState<AppLocale>(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: AppLocale) {
    if (next === locale) return;
    const previous = locale;
    setLocale(next);
    setSaving(true);
    const res = await fetch("/api/settings/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next === "en" ? "EN" : "TH" }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
    } else {
      // Revert the optimistic flip — otherwise the toggle shows the new
      // language as selected while every server-rendered string on the
      // page (having never actually saved) stays in the old one, a
      // whole-UI mismatch that's worse than the same failure mode on a
      // single unit label.
      setLocale(previous);
    }
  }

  return (
    <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
      {(["th", "en"] as const).map((option) => (
        <button
          key={option}
          onClick={() => change(option)}
          disabled={saving}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            locale === option ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {LOCALE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

const KM_PER_MILE = 1.609344;

export function GoalInput({ initialGoalKm, unit }: { initialGoalKm: number | null; unit: UnitSystem }) {
  const t = useTranslations("settings.goalInput");
  const router = useRouter();
  const unitLabel = unit === "IMPERIAL" ? t("mile") : t("km");
  const toDisplay = (km: number) => (unit === "IMPERIAL" ? km / KM_PER_MILE : km);
  const toKm = (display: number) => (unit === "IMPERIAL" ? display * KM_PER_MILE : display);

  const [value, setValue] = useState<string>(initialGoalKm ? toDisplay(initialGoalKm).toFixed(0) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const goalKm = value.trim() === "" ? null : toKm(Number(value));
    await fetch("/api/settings/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalKm }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("placeholder")}
        className="w-36 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
      />
      <span className="text-sm text-neutral-500">{t("perMonth", { unit: unitLabel })}</span>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-[#fc4c02] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </div>
  );
}

export function DeleteAccountButton() {
  const t = useTranslations("settings.deleteAccount");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm(t("confirm"))) return;
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
      {pending ? t("deleting") : t("button")}
    </button>
  );
}
