import { activityColor } from "@/lib/activity-colors";
import { activityTypeLabel } from "@/lib/format";

export interface TypeShare {
  type: string;
  km: number;
}

// Horizontal stacked bar of this month's distance split by activity type —
// the per-type color palette (dashboard list / records / activity detail)
// only meant something once it appeared somewhere at a glance, not just as
// decoration you'd notice one row at a time.
export function TypeBreakdown({ items }: { items: TypeShare[] }) {
  const total = items.reduce((sum, i) => sum + i.km, 0);
  if (total <= 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-4 font-medium">สัดส่วนกิจกรรมเดือนนี้</h2>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-800">
        {items.map((i) => {
          const color = activityColor(i.type);
          const pct = (i.km / total) * 100;
          return <div key={i.type} className={color.solid} style={{ width: `${pct}%` }} title={`${activityTypeLabel(i.type)}: ${i.km.toFixed(1)} กม.`} />;
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {items.map((i) => {
          const color = activityColor(i.type);
          const pct = Math.round((i.km / total) * 100);
          return (
            <div key={i.type} className="flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${color.solid}`} />
              <span className="text-neutral-400">{activityTypeLabel(i.type)}</span>
              <span className="font-medium text-neutral-200">
                {i.km.toFixed(1)} กม. ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
