"use client";

import { useTranslations } from "next-intl";

export interface MacroWeekDay {
  label: string; // short date, e.g. "22 ก.ย."
  carbG: number;
  proteinG: number;
  fatG: number;
  targetCarbG: number;
  targetProteinG: number;
  targetFatG: number;
}

// One macro's cell for one day — "eaten/target", eaten colored amber when
// over that day's own target (same "over = amber" convention
// CalorieTrendChart uses right above this table on the same page, not the
// food diary page's red — each page picked its own color independently and
// staying consistent within a page matters more than matching across them).
function MacroCell({ eaten, target }: { eaten: number; target: number }) {
  const over = target > 0 && eaten > target;
  return (
    <td className="px-2 py-2 text-right tabular-nums">
      <span className={over ? "font-medium text-amber-400" : "text-neutral-200"}>{Math.round(eaten)}</span>
      <span className="text-neutral-600">/{Math.round(target)}</span>
    </td>
  );
}

// A plain table rather than a 3-line chart — three macros compared across
// 7 days at once reads far more clearly as rows of numbers than as three
// overlapping colored lines squeezed into a small mobile-width chart (this
// app's other small charts, e.g. ExerciseProgressionChart, are deliberately
// axis-less sparklines for a single value; three values at once needs exact
// numbers, not just a shape). Requested directly by the user, who confirmed
// "7 วัน" — always exactly 7 rows, not user-configurable.
export function MacroWeekTable({ days }: { days: MacroWeekDay[] }) {
  const t = useTranslations("nutrition.macroWeekTable");
  if (days.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-4 font-medium">{t("title")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800/60 text-neutral-500">
              <th className="py-2 pr-2 text-left font-normal">{t("date")}</th>
              <th className="px-2 py-2 text-right font-normal">
                {t("carb")} ({t("unitG")})
              </th>
              <th className="px-2 py-2 text-right font-normal">
                {t("protein")} ({t("unitG")})
              </th>
              <th className="px-2 py-2 text-right font-normal">
                {t("fat")} ({t("unitG")})
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.label} className="border-b border-neutral-800/40 last:border-0">
                <td className="py-2 pr-2 text-neutral-400">{d.label}</td>
                <MacroCell eaten={d.carbG} target={d.targetCarbG} />
                <MacroCell eaten={d.proteinG} target={d.targetProteinG} />
                <MacroCell eaten={d.fatG} target={d.targetFatG} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">{t("legend")}</p>
    </div>
  );
}
