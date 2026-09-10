import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

function optionalNonNegative(value: unknown, max: number): number | null | typeof INVALID {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : INVALID;
}
const INVALID = Symbol("invalid");

// Logs one body-composition scan (InBody or similar). Only weightKg is
// required — everything else is whatever the user's printout/export
// actually included. Also updates User.weightKg to match, same as
// /api/weight/log, so the rest of the app's "current weight" stays in
// sync with the most recent measurement regardless of which form it came
// from.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const weightKg = Number(body.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 400) {
    return NextResponse.json({ error: "invalid_weight" }, { status: 400 });
  }

  const bodyFatPercent = optionalNonNegative(body.bodyFatPercent, 80);
  const skeletalMuscleMassKg = optionalNonNegative(body.skeletalMuscleMassKg, 200);
  const visceralFatLevel = optionalNonNegative(body.visceralFatLevel, 50);
  const inbodyReportedBmr = optionalNonNegative(body.inbodyReportedBmr, 10000);
  if ([bodyFatPercent, skeletalMuscleMassKg, visceralFatLevel, inbodyReportedBmr].includes(INVALID)) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const [log] = await db.$transaction([
    db.bodyCompositionLog.create({
      data: {
        userId,
        weightKg,
        bodyFatPercent: bodyFatPercent as number | null,
        skeletalMuscleMassKg: skeletalMuscleMassKg as number | null,
        visceralFatLevel: visceralFatLevel as number | null,
        inbodyReportedBmr: inbodyReportedBmr as number | null,
      },
    }),
    db.user.update({ where: { id: userId }, data: { weightKg } }),
  ]);
  return NextResponse.json({ ok: true, id: log.id });
}
