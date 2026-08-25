import { milestoneStatuses, nextMilestone } from "@/lib/achievements";

function BadgeChip({ label, unlocked }: { label: string; unlocked: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
        unlocked ? "border-amber-700/50 bg-amber-950/30 text-amber-300" : "border-neutral-800 bg-neutral-900/40 text-neutral-600"
      }`}
    >
      {unlocked ? "🏅" : "🔒"} {label}
    </span>
  );
}

export function AchievementSection({
  title,
  icon,
  iconColor,
  thresholds,
  current,
  formatLabel,
  formatProgress,
}: {
  title: string;
  icon: string;
  iconColor: string;
  thresholds: number[];
  current: number;
  formatLabel: (v: number) => string;
  formatProgress: (current: number, next: number) => string;
}) {
  const statuses = milestoneStatuses(current, thresholds);
  const next = nextMilestone(current, thresholds);
  const unlockedCount = statuses.filter((s) => s.unlocked).length;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${iconColor}`}>
          <span className="text-base">{icon}</span>
        </div>
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-xs text-neutral-500">
            ปลดล็อกแล้ว {unlockedCount}/{thresholds.length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <BadgeChip key={s.value} label={formatLabel(s.value)} unlocked={s.unlocked} />
        ))}
      </div>

      {next && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-500">
            <span>{formatProgress(current, next.value)}</span>
            <span className="tabular-nums">{Math.round(next.progress * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(next.progress * 100, 2)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
