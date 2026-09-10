import { db } from "./db";
import type { BodyComposition } from "./nutrition";

// The most recent scan's weight + body-fat% is what src/lib/nutrition.ts
// needs to switch computeTargets from the population-average Mifflin-St
// Jeor BMR formula to the more accurate Katch-McArdle one. Every "compute
// today's targets" call site fetches it this same way, so BMR/TDEE/protein
// always agree everywhere the app shows them — same principle
// applyActivityBonus's own comment already documents for the activity
// bonus. Returns null (falls back to the plain formula) when there's no
// scan yet, or the latest one didn't include a body-fat% — weight alone
// isn't enough to derive a lean-body-mass figure.
export async function getLatestBodyComposition(userId: string): Promise<BodyComposition | null> {
  const latest = await db.bodyCompositionLog.findFirst({
    where: { userId },
    orderBy: { loggedAt: "desc" },
    select: { weightKg: true, bodyFatPercent: true },
  });
  if (!latest || latest.bodyFatPercent === null) return null;
  return { weightKg: latest.weightKg, bodyFatPercent: latest.bodyFatPercent };
}
