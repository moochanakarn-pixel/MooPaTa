import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { formatActivityDate, type FormatLang } from "@/lib/format";
import { getRecentWorkoutSessions, type ExerciseSetSummary } from "@/lib/exercise-stats";

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

  const sessions = await getRecentWorkoutSessions(userId, undefined, RECENT_SESSIONS_LIMIT);

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
                <div className="space-y-1.5">
                  {session.exercises.map((ex, i) => (
                    <div key={`${ex.name}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-neutral-300">{ex.name}</span>
                      <span className="text-right tabular-nums text-neutral-500">{formatSetsCompact(ex.sets, tLog)}</span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-neutral-500">
            <Link href="/dashboard/records" className="text-[#fc4c02] hover:underline">
              {t("recordsLink")}
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
