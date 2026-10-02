import { useTranslations } from "next-intl";
import type { WeeklyInsight } from "@/lib/insights";

const ICON: Record<WeeklyInsight["kind"], string> = {
  streakRecord: "🔥",
  activityCount: "🏃",
  activityDuration: "🏃",
  foodConsistency: "🍽️",
  water: "💧",
};

// Up/down colors reuse this page's own convention (set by HealthSummary's
// weight-delta badge right above this card: lime for the direction that
// reads as good news, amber for the other) rather than the emerald/red
// pair the nutrition page uses elsewhere — every kind here is generically
// "more is good" (more workouts, more consistent logging, more water), so
// up is always lime, unlike HealthSummary's weight delta where down is
// the good direction.
function toneClass(kind: WeeklyInsight["kind"], direction: WeeklyInsight["direction"]): string {
  if (kind === "streakRecord") return "text-orange-300";
  return direction === "up" ? "text-lime-400" : "text-amber-400";
}

function insightKey(insight: WeeklyInsight): string {
  if (insight.kind === "streakRecord") return "streakRecord";
  return `${insight.kind}${insight.direction === "up" ? "Up" : "Down"}`;
}

function insightValues(insight: WeeklyInsight): Record<string, number> {
  switch (insight.kind) {
    case "streakRecord":
      return { days: insight.value };
    case "activityCount":
      return { count: insight.value };
    case "activityDuration":
      return { minutes: insight.value };
    case "foodConsistency":
      return { days: insight.value };
    case "water":
      return { liters: insight.value };
  }
}

// Short, automatically-generated "what changed this week" bullets — no
// AI/LLM involved, just a fixed set of candidate this-week-vs-last-week
// comparisons (see buildWeeklyInsights in src/lib/insights.ts) picked from
// data the app already tracks. Sits right under HealthSummary, outside the
// collapsible "more stats" section below it, because the whole point is to
// be something that's immediately visible rather than one more thing to
// dig for.
export function WeeklyInsightsCard({ insights }: { insights: WeeklyInsight[] }) {
  const t = useTranslations("dashboard.weeklyInsights");
  if (insights.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-3 text-sm font-medium text-neutral-400">{t("title")}</h2>
      <ul className="space-y-2">
        {insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="flex-none">{ICON[insight.kind]}</span>
            <span className={`font-medium ${toneClass(insight.kind, insight.direction)}`}>
              {t(insightKey(insight), insightValues(insight))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
