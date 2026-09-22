import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { estimateOneRepMaxKg, getExerciseStats, getRecentWorkoutSessions } from "@/lib/exercise-stats";
import { WeightTrainingTabs } from "./weight-training-tabs";

const RECENT_SESSIONS_LIMIT = 10;

// A dedicated read-only overview of recent weight-training sessions — asked
// for after a user shared their own manually-kept spreadsheet (date, muscle
// group, exercise, per-set reps/load, RPE) and wanted something similar in
// the app to answer "what did I do last time, so I know what to do this
// time." Deliberately does NOT add a muscle-group taxonomy to Exercise (the
// user confirmed exercise name alone is enough — that would be a schema
// change with its own tagging UI, out of scope here) and does NOT try to
// infer/auto-suggest "next in your split" (the user confirmed browsing
// recent history themselves is enough — a real suggestion would need a
// defined rotation the app has no way to know). It's just
// getRecentWorkoutSessions (already built for the "repeat from a previous
// day" picker in log-activity-form.tsx) rendered as a readable list, with a
// higher limit than that picker's 5 since this page's whole purpose is
// browsing history rather than picking one day to copy.
//
// Also owns the "PR ท่าออกกำลังกาย" per-exercise PR list + progression
// charts, moved here from /dashboard/records — that list only ever existed
// there to fill the gap left by WeightTraining having no distance/pace/
// elevation stats of its own, and now that this page exists it makes more
// sense for every piece of weight-training-specific content (session
// history AND per-exercise PRs) to live in one place instead of splitting
// it across two pages that link to each other. The records page's
// WeightTraining card links back here instead.
//
// This page itself only fetches data and does the one computation
// (estimateOneRepMaxKg) that needs a Prisma-adjacent import — actual
// rendering, including the recent-sessions/PR tab switch, lives in
// WeightTrainingTabs (a Client Component, needed for the tab state). The
// two sections used to just run one after another on the page, but got too
// long to scroll past once both had real content.
export default async function WeightTrainingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [t, tc] = await Promise.all([getTranslations("weightTraining"), getTranslations("common")]);

  const [sessions, exerciseStats] = await Promise.all([
    getRecentWorkoutSessions(userId, undefined, RECENT_SESSIONS_LIMIT),
    getExerciseStats(userId),
  ]);

  // Only exercises with an actual weight logged have a meaningful PR — a
  // bodyweight-only exercise (weightKg never given) has nothing numeric to
  // rank, so prWeightKg stays null for it and it's left out of this list.
  // Sorted by most-recently-trained first (latestAtMs, not name) — this is
  // a "what have I been working on" feed, not an alphabetical reference
  // list, so whatever was just logged today should surface at the top
  // instead of being buried wherever its name happens to fall alphabetically.
  const prItems = exerciseStats
    .filter((s): s is typeof s & { prWeightKg: number } => s.prWeightKg !== null)
    .sort((a, b) => b.latestAtMs - a.latestAtMs)
    .map((s) => ({
      name: s.name,
      prActivityId: s.prActivityId,
      prAtMs: s.prAtMs,
      latestAtMs: s.latestAtMs,
      prWeightKg: s.prWeightKg,
      prReps: s.prReps,
      // At exactly 1 rep the PR set already is the 1RM — an "estimate"
      // line would just repeat the number above.
      oneRepMaxEstimate: s.prReps > 1 ? Math.round(estimateOneRepMaxKg(s.prWeightKg, s.prReps)) : null,
      // Session-over-session trend — only weighted sessions have a numeric
      // point to plot (a bodyweight-only session for this name in between
      // two weighted ones just isn't part of the weight trend at all).
      progressionPoints: s.history
        .filter((h): h is typeof h & { maxWeightKg: number } => h.maxWeightKg !== null)
        .map((h) => ({ ms: h.atMs, value: h.maxWeightKg })),
    }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tc("backToOverview")}
      </Link>

      <h1 className="mb-1 text-xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-sm text-neutral-500">{t("subtitle")}</p>

      {sessions.length === 0 ? <p className="text-neutral-500">{t("emptyState")}</p> : <WeightTrainingTabs sessions={sessions} prItems={prItems} />}
    </main>
  );
}
