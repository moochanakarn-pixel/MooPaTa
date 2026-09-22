"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";

export interface MacroWeekDay {
  label: string; // short date, e.g. "22 ก.ย."
  carbG: number;
  proteinG: number;
  fatG: number;
  targetCarbG: number;
  targetProteinG: number;
  targetFatG: number;
  // Same activity-bonus values the "เพิ่มจากกิจกรรมวันนี้" note above this
  // table shows, but per historical day instead of just today — explains
  // why some rows' targets are higher than others instead of leaving that
  // implicit. Both 0 and bonusDurationLabel null on a day with no logged
  // activity, so the caption line below simply doesn't render for it.
  carbBonusG: number;
  proteinBonusG: number;
  bonusDurationLabel: string | null;
  // null when no activity that day had a calories figure entered (it's an
  // optional field) — distinct from having genuinely burned 0, so the
  // caption below only appends "· N kcal" when there's a real number,
  // never a misleading "· 0 kcal".
  caloriesBurned: number | null;
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
            {days.map((d, i) => {
              // > 0 rather than checking bonusDurationLabel directly — a
              // very short logged activity can round down to +0g for both
              // macros (Math.round in activityMacroBonus), and a "+0
              // คาร์บ/+0 โปรตีน" caption would just be noise, same
              // no-meaningless-zero convention the rest of the app follows
              // (e.g. the "+0 kcal" activity-bonus row elsewhere never
              // renders either).
              const hasBonus = d.carbBonusG > 0 || d.proteinBonusG > 0;
              // The border between one day's block and the next belongs on
              // whichever row is visually last in that block — the main row
              // when there's no caption, the caption row when there is —
              // and not at all after the very last day.
              const isLastDay = i === days.length - 1;
              const borderClass = isLastDay ? "" : "border-b border-neutral-800/40";
              return (
                <Fragment key={d.label}>
                  <tr className={hasBonus ? "" : borderClass}>
                    <td className="py-2 pr-2 text-neutral-400">{d.label}</td>
                    <MacroCell eaten={d.carbG} target={d.targetCarbG} />
                    <MacroCell eaten={d.proteinG} target={d.targetProteinG} />
                    <MacroCell eaten={d.fatG} target={d.targetFatG} />
                  </tr>
                  {hasBonus && (
                    <tr className={borderClass}>
                      <td colSpan={4} className="pb-2 text-[10px] text-neutral-600">
                        {/* bonusDurationLabel is only null when carbBonusG/proteinBonusG are both
                            0 (no logged activity that day) — hasBonus above already excludes that
                            case, so this is always a real duration string here. */}
                        {d.caloriesBurned !== null
                          ? t("bonusNoteWithCalories", {
                              carb: d.carbBonusG,
                              protein: d.proteinBonusG,
                              duration: d.bonusDurationLabel ?? "",
                              kcal: Math.round(d.caloriesBurned),
                            })
                          : t("bonusNote", { carb: d.carbBonusG, protein: d.proteinBonusG, duration: d.bonusDurationLabel ?? "" })}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">{t("legend")}</p>
    </div>
  );
}
