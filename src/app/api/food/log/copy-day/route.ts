import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { parseBackfillLoggedAt } from "@/lib/streak";

// Copies every food logged on one day onto another — "คัดลอกเมื่อวานทั้งหมด"
// for a day that mostly repeats what was eaten before, instead of
// re-adding each item by hand. Each copied row points at the same Food
// as its source (not a duplicate Food row), same as the single-entry
// repeat endpoint. Both dates go through parseBackfillLoggedAt (same
// validation POST /api/food/log, its /repeat endpoint, and POST
// /api/water/log already use) rather than a separate hand-rolled parser —
// that one also enforces "not more than 1 year in the past," which a
// once-separate copy of this date parsing here used to skip entirely.
// Both dates are required for this endpoint, so parseBackfillLoggedAt's
// "wasn't sent at all" `undefined` case is rejected the same as `null`.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fromDate = parseBackfillLoggedAt(body.fromDate);
  const toDate = parseBackfillLoggedAt(body.toDate);
  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const fromStart = new Date(fromDate);
  fromStart.setHours(0, 0, 0, 0);
  const fromEnd = new Date(fromStart);
  fromEnd.setDate(fromEnd.getDate() + 1);

  const sourceLogs = await db.foodLog.findMany({
    where: { userId, loggedAt: { gte: fromStart, lt: fromEnd } },
  });
  if (sourceLogs.length === 0) {
    return NextResponse.json({ error: "nothing_to_copy" }, { status: 400 });
  }

  await db.foodLog.createMany({
    data: sourceLogs.map((l) => ({
      userId,
      foodId: l.foodId,
      grams: l.grams,
      mealType: l.mealType,
      loggedAt: toDate,
    })),
  });

  return NextResponse.json({ ok: true, count: sourceLogs.length });
}
