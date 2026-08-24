import Link from "next/link";
import { activityColor } from "@/lib/activity-colors";
import {
  activityTypeLabel,
  formatDistanceKm,
  formatElevationM,
  formatPace,
  formatSpeedKmh,
  type UnitSystem,
} from "@/lib/format";

interface HighlightActivity {
  id: string;
  type: string;
  distanceMeters: number | null;
  avgSpeedMs: number | null;
  elevationGainM: number | null;
}

// "Best of this month" pulled onto the dashboard itself — previously this
// kind of standout stat only existed on /dashboard/records, all-time and a
// click away. Most sessions never go past the dashboard, so the payoff of
// "look what you did" belongs on the page people actually open every day.
export function MonthHighlights({ activities, unit }: { activities: HighlightActivity[]; unit: UnitSystem }) {
  if (activities.length === 0) return null;

  const longest = activities.reduce((best, a) =>
    (a.distanceMeters ?? 0) > (best?.distanceMeters ?? 0) ? a : best
  );
  const fastest = activities.reduce((best, a) => ((a.avgSpeedMs ?? 0) > (best?.avgSpeedMs ?? 0) ? a : best));
  const highestClimb = activities.reduce((best, a) =>
    (a.elevationGainM ?? 0) > (best?.elevationGainM ?? 0) ? a : best
  );

  const cards = [
    longest.distanceMeters
      ? {
          activity: longest,
          label: "ไกลที่สุดเดือนนี้",
          value: formatDistanceKm(longest.distanceMeters, unit),
          icon: "M4 19h3l2-9 4 14 2-9h5",
        }
      : null,
    fastest.avgSpeedMs
      ? {
          activity: fastest,
          label: "เร็วที่สุดเดือนนี้",
          value: fastest.type === "Run" ? formatPace(fastest.avgSpeedMs, unit) : formatSpeedKmh(fastest.avgSpeedMs, unit),
          icon: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z",
        }
      : null,
    highestClimb.elevationGainM
      ? {
          activity: highestClimb,
          label: "ไต่ระดับเยอะสุดเดือนนี้",
          value: formatElevationM(highestClimb.elevationGainM, unit),
          icon: "M3 18 8 8l4 6 3-4 6 8H3Z",
        }
      : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => {
        const color = activityColor(c.activity.type);
        return (
          <Link
            key={c.label}
            href={`/dashboard/activity/${c.activity.id}`}
            className="group relative overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition hover:border-neutral-700"
          >
            <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full ${color.bg} blur-xl transition group-hover:opacity-80`} />
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" className={`mb-2 h-4 w-4 ${color.text}`}>
                <path d={c.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-lg font-bold tracking-tight">{c.value}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {c.label} · {activityTypeLabel(c.activity.type)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
