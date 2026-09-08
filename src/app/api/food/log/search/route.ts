import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { macrosForGrams } from "@/lib/food";
import { localDateKey } from "@/lib/streak";

const RESULT_LIMIT = 100;

// Searches this user's whole food-log history (not just the viewed day)
// by food name — "when was the last time I ate X" / finding an old entry
// to repeat. MySQL's default collation already matches case-insensitively,
// so a plain `contains` is enough.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const rows = await db.foodLog.findMany({
    where: { userId, food: { name: { contains: q } } },
    include: { food: true },
    orderBy: { loggedAt: "desc" },
    take: RESULT_LIMIT,
  });

  const results = rows.map((l) => {
    const m = macrosForGrams(l.food, l.grams);
    return {
      id: l.id,
      foodId: l.foodId,
      foodName: l.food.name,
      grams: l.grams,
      mealType: l.mealType,
      calories: m.calories,
      date: localDateKey(l.loggedAt),
    };
  });

  return NextResponse.json({ results });
}
