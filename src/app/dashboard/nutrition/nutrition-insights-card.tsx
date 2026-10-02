import { useTranslations } from "next-intl";
import type { NutritionInsight } from "@/lib/insights";

const ICON: Record<NutritionInsight["kind"], string> = {
  weightTrend: "⚖️",
  proteinTotal: "🥩",
};

// weightTrend inverts vs proteinTotal on purpose: a weight drop reads as
// good news here (lime), more protein also reads as good news (lime) —
// see the comment on NutritionInsight.direction in insights.ts for why
// weight doesn't check the user's actual goal before picking a color.
function toneClass(insight: NutritionInsight): string {
  const goodNews = insight.kind === "weightTrend" ? insight.direction === "down" : insight.direction === "up";
  return goodNews ? "text-lime-400" : "text-amber-400";
}

function insightKey(insight: NutritionInsight): string {
  return `${insight.kind}${insight.direction === "up" ? "Up" : "Down"}`;
}

// Same "this week vs last week, no AI involved" pattern as the dashboard's
// WeeklyInsightsCard, scoped to this page's own data (weight trend, total
// protein) rather than duplicating it — see buildNutritionInsights in
// src/lib/insights.ts. Reuses periodComparison's title text since it's the
// exact same "this week vs last week" framing already established on this
// page right below.
export function NutritionInsightsCard({ insights }: { insights: NutritionInsight[] }) {
  const t = useTranslations("nutrition.weeklyInsights");
  const tp = useTranslations("nutrition.periodComparison");
  if (insights.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-3 text-sm font-medium text-neutral-400">{tp("title")}</h2>
      <ul className="space-y-2">
        {insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="flex-none">{ICON[insight.kind]}</span>
            <span className={`font-medium ${toneClass(insight)}`}>{t(insightKey(insight), { value: insight.value })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
