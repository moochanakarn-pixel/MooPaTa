import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Cleans up personal-library foods that ended up as separate rows despite
// sharing the exact same name — the state POST /api/food/log's own
// exact-name reuse check (see that route) now prevents going forward, but
// can't retroactively fix rows created before that existed, or rows
// created by anything that writes to the DB directly instead of going
// through that endpoint (e.g. a one-off backfill script).
//
// For each group of same-named, non-deleted foods: keeps the one with the
// most FoodLog entries (ties broken by oldest createdAt — the "most
// established" row), repoints every other row's FoodLog entries at it, and
// soft-deletes the rest. Never touches FoodLog rows themselves — every
// diary entry keeps its id/date/mealType/grams, it just ends up pointing
// at one shared Food row instead of several duplicate ones, exactly like a
// manual "pick from library" always did.
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const foods = await db.food.findMany({
    where: { userId, deletedAt: null },
    include: { _count: { select: { logs: true } } },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof foods>();
  for (const f of foods) {
    const key = f.name.trim().toLowerCase();
    const group = groups.get(key);
    if (group) group.push(f);
    else groups.set(key, [f]);
  }

  const merged: { name: string; keptId: string; mergedCount: number; movedLogs: number }[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b._count.logs - a._count.logs || a.createdAt.getTime() - b.createdAt.getTime());
    const [canonical, ...duplicates] = sorted;

    let movedLogs = 0;
    for (const dup of duplicates) {
      const result = await db.foodLog.updateMany({ where: { foodId: dup.id }, data: { foodId: canonical.id } });
      movedLogs += result.count;
      await db.food.update({ where: { id: dup.id }, data: { deletedAt: new Date() } });
    }

    merged.push({ name: canonical.name, keptId: canonical.id, mergedCount: duplicates.length, movedLogs });
  }

  return NextResponse.json({ ok: true, merged });
}
