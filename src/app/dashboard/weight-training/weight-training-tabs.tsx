"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatActivityDate, type FormatLang } from "@/lib/format";
import { ExerciseProgressionChart } from "./exercise-progression-chart";

interface SetSummary {
  reps: number;
  weightKg: number | null;
  rpe: number | null;
}

export interface SessionSummary {
  activityId: string;
  startedAtMs: number;
  exercises: { name: string; sets: SetSummary[] }[];
}

export interface PrListItem {
  name: string;
  prActivityId: string;
  prAtMs: number;
  prWeightKg: number;
  prReps: number;
  // Pre-computed server-side (Math.round(estimateOneRepMaxKg(...))) —
  // estimateOneRepMaxKg itself lives in src/lib/exercise-stats.ts, which
  // imports the Prisma client (./db) at module scope, so importing it here
  // would drag Node-only code into the client bundle. null when reps===1
  // (the PR set already is a measured 1RM, no estimate to show).
  oneRepMaxEstimate: number | null;
  progressionPoints: { ms: number; value: number }[];
}

// Same "15×5กก. (RPE 8), 14×5กก. (RPE 8)" compact format as page.tsx used to
// have server-side (and log-activity-form.tsx's own client-side copy) —
// duplicated rather than shared since each lives on its own side of the
// server/client boundary. Reads the same logActivity.compactSetWithWeight/
// compactSetNoWeight keys so all three stay in sync in spirit.
function formatSetsCompact(sets: SetSummary[], t: ReturnType<typeof useTranslations>): string {
  return sets
    .map((s) => {
      const base = s.weightKg !== null ? t("compactSetWithWeight", { reps: s.reps, weight: s.weightKg }) : t("compactSetNoWeight", { reps: s.reps });
      return s.rpe !== null ? `${base} (RPE ${s.rpe})` : base;
    })
    .join(", ");
}

// Recent-sessions history and the exercise-PR list used to just run one
// after another on the page — fine with a handful of sessions/exercises,
// but the user found it got too long to scroll past once both sections had
// real content (10 sessions' worth of exercises, then a separate PR per
// exercise on top). Splitting them into tabs matches the same pattern
// already used elsewhere in the app (e.g. the manual/AI-import toggle on
// the log-activity form) instead of introducing a new UI convention.
export function WeightTrainingTabs({ sessions, prItems }: { sessions: SessionSummary[]; prItems: PrListItem[] }) {
  const t = useTranslations("weightTraining");
  const tLog = useTranslations("logActivity");
  const locale = useLocale();
  const lang: FormatLang = locale === "en" ? "en" : "th";

  // No PR data at all (e.g. only bodyweight exercises ever logged) — a tab
  // bar with an empty second tab would just be confusing, so fall back to
  // showing the sessions list alone like before this page had a PR section.
  const [tab, setTab] = useState<"sessions" | "pr">("sessions");
  const showTabs = prItems.length > 0;

  return (
    <div>
      {showTabs && (
        <div className="mb-4 flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900/60 p-1">
          {(["sessions", "pr"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === key ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {key === "sessions" ? t("recentSessionsTitle") : t("exercisePrTitle")}
            </button>
          ))}
        </div>
      )}

      {(!showTabs || tab === "sessions") && (
        <div>
          {!showTabs && <h2 className="mb-4 font-medium">{t("recentSessionsTitle")}</h2>}
          <div className="space-y-4">
            {sessions.map((session) => (
              <Link
                key={session.activityId}
                href={`/dashboard/activity/${session.activityId}`}
                className="block rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5 transition hover:border-neutral-700 hover:bg-neutral-900/70"
              >
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-medium text-neutral-100">{formatActivityDate(new Date(session.startedAtMs), lang)}</h2>
                  <span className="flex-none text-xs text-neutral-500">{t("sessionExerciseCount", { count: session.exercises.length })}</span>
                </div>
                {/* Name and sets stack vertically (not side-by-side) — a
                    long exercise name and a long multi-set summary
                    (pyramids/drop sets easily run 5-6 sets) fighting over a
                    single row's width on a narrow phone screen crushes the
                    name into a tall, hard-to-read sliver. Full-width rows
                    read cleanly regardless of how long either piece of
                    text is. */}
                <div className="space-y-2.5">
                  {session.exercises.map((ex, i) => (
                    <div key={`${ex.name}-${i}`} className="text-sm">
                      <p className="text-neutral-300">{ex.name}</p>
                      <p className="tabular-nums text-neutral-500">{formatSetsCompact(ex.sets, tLog)}</p>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showTabs && tab === "pr" && (
        <div className="space-y-2">
          {prItems.map((s) => (
            <div
              key={s.name}
              className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3 transition hover:border-neutral-700 hover:bg-neutral-900/70"
            >
              <Link href={`/dashboard/activity/${s.prActivityId}`} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-200">{s.name}</p>
                  <p className="text-xs text-neutral-500">{formatActivityDate(new Date(s.prAtMs), lang)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-neutral-100">
                    {s.prWeightKg} {t("kg")} × {s.prReps}
                  </p>
                  {s.oneRepMaxEstimate !== null && (
                    <p className="text-xs tabular-nums text-neutral-500">{t("oneRepMaxEstimate", { value: s.oneRepMaxEstimate })}</p>
                  )}
                </div>
              </Link>
              {/* formatValue must NOT prepend its own sign — the chart
                  already renders "+" for a positive delta itself
                  (toFixed already emits "-" for negatives). */}
              <ExerciseProgressionChart points={s.progressionPoints} color="#8b5cf6" formatValue={(v) => `${v.toFixed(1)} ${t("kg")}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
