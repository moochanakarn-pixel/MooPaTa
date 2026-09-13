import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLatestBodyComposition } from "@/lib/body-composition";
import {
  FAT_PERCENT_MAX,
  FAT_PERCENT_MIN,
  PROTEIN_G_PER_KG_LBM_MAX,
  PROTEIN_G_PER_KG_LBM_MIN,
  PROTEIN_G_PER_KG_MAX,
  PROTEIN_G_PER_KG_MIN,
} from "@/lib/nutrition";
import { getSessionUserId } from "@/lib/session";

// null resets that field back to the built-in default (see computeTargets) —
// same "null means use the default" convention every other optional
// nutrition-profile field on User already uses. A provided number is
// validated against whichever protein range is currently active for this
// user (bodyweight- or lean-mass-based, depending on whether they have a
// body-composition scan) so the stored value can never be one the settings
// form wouldn't have let them pick in the first place.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  let proteinGPerKg: number | null = null;
  if (body.proteinGPerKg !== null && body.proteinGPerKg !== undefined) {
    proteinGPerKg = Number(body.proteinGPerKg);
    const usedBodyComposition = (await getLatestBodyComposition(userId)) !== null;
    const min = usedBodyComposition ? PROTEIN_G_PER_KG_LBM_MIN : PROTEIN_G_PER_KG_MIN;
    const max = usedBodyComposition ? PROTEIN_G_PER_KG_LBM_MAX : PROTEIN_G_PER_KG_MAX;
    if (!Number.isFinite(proteinGPerKg) || proteinGPerKg < min || proteinGPerKg > max) {
      return NextResponse.json({ error: "invalid_protein" }, { status: 400 });
    }
  }

  let fatPercentOfCalories: number | null = null;
  if (body.fatPercentOfCalories !== null && body.fatPercentOfCalories !== undefined) {
    fatPercentOfCalories = Number(body.fatPercentOfCalories);
    if (!Number.isFinite(fatPercentOfCalories) || fatPercentOfCalories < FAT_PERCENT_MIN || fatPercentOfCalories > FAT_PERCENT_MAX) {
      return NextResponse.json({ error: "invalid_fat" }, { status: 400 });
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { proteinGPerKg, fatPercentOfCalories },
  });
  return NextResponse.json({ ok: true });
}
