"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Celebration } from "@/lib/achievements";
import { formatDistanceKm, type FormatLang, type UnitSystem } from "@/lib/format";

// Same emoji the achievements page already uses for each category's icon
// (🏁/📋/🔥/🏋️) plus the 🏅 the exercise-PR badge list uses — kept consistent
// so this overlay and the achievements page read as the same feature rather
// than two different visual vocabularies for the same four milestones.
const ICON: Record<Celebration["type"], string> = {
  distance: "🏁",
  count: "📋",
  streak: "🔥",
  liftVolume: "🏋️",
  exercisePr: "🏅",
};

// Shown right after a successful *create* (never an edit — see
// log-activity-form.tsx's save(), celebrations are only ever read off the
// POST response) when POST /api/activity/manual's response included one or
// more newly-crossed achievement milestones / new exercise PRs. Achievements
// are otherwise purely derived — nothing is ever marked "unlocked" in the
// database — so without this, the only way to find out is to go open
// /dashboard/achievements yourself and notice something changed.
//
// Closing it always continues the pending navigation (there's no "cancel"
// here, just "I've seen it") — tap the backdrop, press Escape, or tap the
// button, all call the same onContinue.
export function CelebrationOverlay({
  celebrations,
  unit,
  onContinue,
}: {
  celebrations: Celebration[];
  unit: UnitSystem;
  onContinue: () => void;
}) {
  const t = useTranslations("logActivity");
  const locale = useLocale();
  const lang: FormatLang = locale === "en" ? "en" : "th";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onContinue();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onContinue]);

  function describe(c: Celebration): string {
    switch (c.type) {
      case "distance":
        return t("celebrationDistance", { value: formatDistanceKm(c.value * 1000, unit, lang) });
      case "count":
        return t("celebrationCount", { count: c.value });
      case "streak":
        return t("celebrationStreak", { days: c.value });
      case "liftVolume":
        return t("celebrationLift", { value: c.value.toLocaleString(lang === "en" ? "en-US" : "th-TH") });
      case "exercisePr":
        return t("celebrationPr", { name: c.exerciseName ?? "", weight: c.value });
    }
  }

  if (celebrations.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onContinue}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="celebration-pop w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-900 p-6 text-center"
      >
        <p className="mb-1 text-4xl">🎉</p>
        <h2 className="mb-4 text-lg font-bold text-neutral-100">{t("celebrationHeading")}</h2>
        <div className="mb-5 space-y-2.5">
          {celebrations.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl bg-neutral-800/60 px-3 py-2.5 text-left">
              <span className="flex-none text-xl">{ICON[c.type]}</span>
              <span className="text-sm font-medium text-neutral-200">{describe(c)}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onContinue}
          className="w-full rounded-xl bg-[#fc4c02] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#e04402]"
        >
          {t("celebrationContinue")}
        </button>
      </div>
    </div>
  );
}
