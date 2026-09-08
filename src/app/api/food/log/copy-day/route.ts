import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { localDateKey } from "@/lib/streak";

function parseDateKey(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== m - 1) return null;
  return date;
}

// Copies every food logged on one day onto another — "คัดลอกเมื่อวานทั้งหมด"
// for a day that mostly repeats what was eaten before, instead of
// re-adding each item by hand. Each copied row points at the same Food
// as its source (not a duplicate Food row), same as the single-entry
// repeat endpoint.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fromDate = parseDateKey(body.fromDate);
  const toDate = parseDateKey(body.toDate);
  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  if (localDateKey(toDate) > localDateKey(new Date())) {
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
