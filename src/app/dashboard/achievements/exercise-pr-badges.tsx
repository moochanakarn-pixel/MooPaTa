import Link from "next/link";
import { useTranslations } from "next-intl";
import { estimateOneRepMaxKg } from "@/lib/exercise-stats";
import { BadgeChip } from "./achievement-section";

// The per-exercise counterpart to the numeric milestone ladders above —
// those need a fixed threshold list to show locked/unlocked against, which
// doesn't make sense here (there's no way to know in advance which exercise
// names someone will eventually try), so this is a plain badge list instead:
// one earned badge per exercise that has a PR at all, always shown
// "unlocked" (🏅) since just having a PR means it's already earned. Sorted
// most-recent-first so this reads as a feed of "what did I just achieve"
// rather than a reference list — that's what src/app/dashboard/records/page.tsx's
// alphabetical "PR ท่าออกกำลังกาย" section is already for.
export function ExercisePrBadges({
  exercises,
}: {
  exercises: { name: string; weightKg: number; reps: number; activityId: string }[];
}) {
  const t = useTranslations("achievements");

  if (exercises.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
          <span className="text-base">🏆</span>
        </div>
        <div>
          <h2 className="font-medium">{t("prTitle")}</h2>
          <p className="text-xs text-neutral-500">{t("prSubtitle", { count: exercises.length })}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {exercises.map((e) => {
          // Same reps===1 guard as records page's "PR ท่าออกกำลังกาย" list —
          // at 1 rep the PR weight already *is* a measured 1RM, so Epley's
          // estimate (which doesn't collapse to the input weight there)
          // would misleadingly suggest a higher number than actually lifted.
          const oneRm = e.reps > 1 ? Math.round(estimateOneRepMaxKg(e.weightKg, e.reps)) : null;
          const label =
            oneRm !== null
              ? t("prBadgeWithOneRm", { name: e.name, weight: e.weightKg, oneRm })
              : t("prBadgeNoOneRm", { name: e.name, weight: e.weightKg });
          return (
            <Link key={e.name} href={`/dashboard/activity/${e.activityId}`}>
              <BadgeChip label={label} unlocked />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
