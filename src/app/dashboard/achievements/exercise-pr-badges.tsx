import Link from "next/link";
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
  exercises: { name: string; weightKg: number; activityId: string }[];
}) {
  if (exercises.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
          <span className="text-base">🏆</span>
        </div>
        <div>
          <h2 className="font-medium">PR ท่าเวท</h2>
          <p className="text-xs text-neutral-500">{exercises.length} ท่าที่เคยทำสถิติน้ำหนักสูงสุดไว้</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {exercises.map((e) => (
          <Link key={e.name} href={`/dashboard/activity/${e.activityId}`}>
            <BadgeChip label={`${e.name} ${e.weightKg} กก.`} unlocked />
          </Link>
        ))}
      </div>
    </div>
  );
}
