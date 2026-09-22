"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { UnitSystem } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";
import { LOGGABLE_ACTIVITY_TYPES, type LoggableActivityType } from "@/lib/activity-types";

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

export interface ActivityGoalEntry {
  activityType: string;
  goalKm: number;
}

// One goal per activity type (ActivityGoal model) — replaces the old
// single-number GoalInput. Each configured type gets its own editable row
// (value + save + delete); a second row below lets the user add a goal for
// any type that doesn't have one yet, hidden once every loggable type is
// already configured. Reuses `logActivity`'s type labels (Run/Ride/...)
// instead of duplicating them in the `settings` namespace, same "reuse
// across pages" convention as compare-view.tsx's second useTranslations
// call for activityDetail.stats.
export function ActivityGoalsInput({ initialGoals, unit }: { initialGoals: ActivityGoalEntry[]; unit: UnitSystem }) {
  const t = useTranslations("settings.goalInput");
  const tType = useTranslations("logActivity");
  const locale = useLocale();
  const unitLabel = unit === "IMPERIAL" ? t("mile") : t("km");
  const toDisplay = (km: number) => (unit === "IMPERIAL" ? km / KM_PER_MILE : km);
  const toKm = (display: number) => (unit === "IMPERIAL" ? display * KM_PER_MILE : display);
  const typeLabel = (type: string) => tType(`type${type}` as `type${LoggableActivityType}`);

  const [goals, setGoals] = useState<ActivityGoalEntry[]>(initialGoals);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialGoals.map((g) => [g.activityType, toDisplay(g.goalKm).toFixed(0)]))
  );
  const [savingType, setSavingType] = useState<string | null>(null);

  const configuredTypes = new Set(goals.map((g) => g.activityType));
  const availableTypes = LOGGABLE_ACTIVITY_TYPES.filter((v) => !configuredTypes.has(v));
  const [newType, setNewType] = useState<string>(availableTypes[0] ?? "");
  const [newValue, setNewValue] = useState("");
  // Keep the "add" dropdown's selection valid as the available list shrinks
  // (a type just got configured) or grows (one was deleted) — a stale
  // selection would silently resubmit for a type no longer offered.
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(newType as LoggableActivityType)) {
      setNewType(availableTypes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTypes.join(",")]);

  async function saveGoal(activityType: string, rawValue: string) {
    const parsed = Number(rawValue);
    if (rawValue.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) return;
    setSavingType(activityType);
    const goalKm = toKm(parsed);
    await fetch("/api/settings/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityType, goalKm }),
    });
    setGoals((prev) => [...prev.filter((g) => g.activityType !== activityType), { activityType, goalKm }]);
    setDrafts((prev) => ({ ...prev, [activityType]: rawValue }));
    setSavingType(null);
  }

  async function removeGoal(activityType: string) {
    setSavingType(activityType);
    await fetch("/api/settings/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityType, goalKm: null }),
    });
    setGoals((prev) => prev.filter((g) => g.activityType !== activityType));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activityType];
      return next;
    });
    setSavingType(null);
  }

  return (
    <div className="space-y-3">
      {goals.length > 0 && (
        <div className="space-y-2">
          {goals.map((g) => (
            <div key={g.activityType} className="flex items-center gap-2">
              <span className="w-28 flex-none truncate text-sm text-neutral-300">{typeLabel(g.activityType)}</span>
              <input
                type="number"
                min="1"
                value={drafts[g.activityType] ?? ""}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [g.activityType]: e.target.value }))}
                className="w-24 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
              <span className="text-sm text-neutral-500">{unitLabel}</span>
              <button
                onClick={() => saveGoal(g.activityType, drafts[g.activityType] ?? "")}
                disabled={savingType === g.activityType}
                className="rounded-lg bg-[#fc4c02] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
              >
                {savingType === g.activityType ? t("saving") : t("save")}
              </button>
              <button
                onClick={() => removeGoal(g.activityType)}
                disabled={savingType === g.activityType}
                className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition hover:border-red-900/60 hover:text-red-300 disabled:opacity-50"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      )}

      {availableTypes.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="w-28 flex-none rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-600"
          >
            {availableTypes.map((v) => (
              <option key={v} value={v}>
                {typeLabel(v)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={t("placeholder")}
            className="w-24 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
          />
          <span className="text-sm text-neutral-500">{unitLabel}</span>
          <button
            onClick={async () => {
              await saveGoal(newType, newValue);
              setNewValue("");
            }}
            disabled={savingType === newType || newValue.trim() === ""}
            className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-700 disabled:opacity-50"
          >
            {t("add")}
          </button>
        </div>
      )}
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
