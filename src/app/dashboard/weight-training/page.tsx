import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { formatActivityDate, type FormatLang } from "@/lib/format";
import { estimateOneRepMaxKg, getExerciseStats, getRecentWorkoutSessions, type ExerciseSetSummary } from "@/lib/exercise-stats";
import { ExerciseProgressionChart } from "./exercise-progression-chart";

const RECENT_SESSIONS_LIMIT = 10;

// Same "15×5กก. (RPE 8), 14×5กก. (RPE 8)" compact format as
// log-activity-form.tsx's formatSetsCompact — duplicated rather than
// imported since that one is a client-side helper reached through a
// "use client" file, and this page is a Server Component. Both read the
// same logActivity.compactSetWithWeight/compactSetNoWeight message keys so
// the two stay in sync in spirit even though the code isn't shared.
function formatSetsCompact(sets: ExerciseSetSummary[], t: Awaited<ReturnType<typeof getTranslations<"logActivity">>>): string {
  return sets
    .map((s) => {
      const base = s.weightKg !== null ? t("compactSetWithWeight", { reps: s.reps, weight: s.weightKg }) : t("compactSetNoWeight", { reps: s.reps });
      return s.rpe !== null ? `${base} (RPE ${s.rpe})` : base;
    })
    .join(", ");
}

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
export default async function WeightTrainingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [t, tc, tLog, locale] = await Promise.all([
    getTranslations("weightTraining"),
    getTranslations("common"),
    getTranslations("logActivity"),
    getLocale(),
  ]);
  const lang: FormatLang = locale === "en" ? "en" : "th";

  const [sessions, exerciseStats] = await Promise.all([
    getRecentWorkoutSessions(userId, undefined, RECENT_SESSIONS_LIMIT),
    getExerciseStats(userId),
  ]);

  // Only exercises with an actual weight logged have a meaningful PR — a
  // bodyweight-only exercise (weightKg never given) has nothing numeric to
  // rank, so prWeightKg stays null for it and it's left out of this list.
  const prList = exerciseStats
    .filter((s) => s.prWeightKg !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

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

      {sessions.length === 0 ? (
        <p className="text-neutral-500">{t("emptyState")}</p>
      ) : (
        <>
          <h2 className="mb-4 font-medium">{t("recentSessionsTitle")}</h2>
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
                {/* Name and sets stack vertically (not side-by-side) —
                    a long exercise name and a long multi-set summary
                    (pyramids/drop sets easily run 5-6 sets) fighting over
                    a single row's width on a narrow phone screen crushes
                    the name into a tall, hard-to-read sliver. Full-width
                    rows read cleanly regardless of how long either piece
                    of text is. */}
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

          {prList.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 font-medium">{t("exercisePrTitle")}</h2>
              <div className="space-y-2">
                {prList.map((s) => {
                  // Session-over-session trend — only weighted sessions
                  // have a numeric point to plot (a bodyweight-only session
                  // for this name in between two weighted ones just isn't
                  // part of the weight trend at all).
                  const progressionPoints = s.history
                    .filter((h): h is typeof h & { maxWeightKg: number } => h.maxWeightKg !== null)
                    .map((h) => ({ ms: h.atMs, value: h.maxWeightKg }));
                  return (
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
                          {/* At exactly 1 rep the PR set already is the 1RM — an
                              "estimate" line would just repeat the number above.
                              prWeightKg is only possibly null before the filter
                              above (bodyweight-only exercises, excluded from
                              this list already) — re-checked here because that
                              filter doesn't narrow the array's element type. */}
                          {s.prWeightKg !== null && s.prReps > 1 && (
                            <p className="text-xs tabular-nums text-neutral-500">
                              {t("oneRepMaxEstimate", { value: Math.round(estimateOneRepMaxKg(s.prWeightKg, s.prReps)) })}
                            </p>
                          )}
                        </div>
                      </Link>
                      {/* formatValue must NOT prepend its own sign — the
                          chart already renders "+" for a positive delta
                          itself (toFixed already emits "-" for negatives),
                          so doing it here too produced a literal "++10.0กก."
                          on any positive trend (caught live while testing
                          this page, pre-existing in the code this section
                          was moved from). */}
                      <ExerciseProgressionChart
                        points={progressionPoints}
                        color="#8b5cf6"
                        formatValue={(v) => `${v.toFixed(1)} ${t("kg")}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
