import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Foods with the same name but different actual macro values (a typo in
// one entry, a more-accurate re-entry later, two genuinely different
// products someone happened to name the same thing) must never be merged
// automatically — every FoodLog always computes its macros live from
// whichever Food row it currently points at, so repointing a log at a row
// with different per-100 values silently changes what that log has always
// shown, with no way to tell it happened. Only exact-macro duplicates
// (same unitLabel and per-100 values) are safe to auto-merge; anything
// else groups by name but is reported as a conflict instead, for the user
// to resolve by hand.
function macroKey(f: { unitLabel: string; caloriesPer100g: number; proteinPer100g: number; carbPer100g: number; fatPer100g: number }): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  return [f.unitLabel, round(f.caloriesPer100g), round(f.proteinPer100g), round(f.carbPer100g), round(f.fatPer100g)].join("|");
}

// Cleans up personal-library foods that ended up as separate rows despite
// sharing the exact same name — the state POST /api/food/log's own
// exact-name reuse check (see that route) now prevents going forward, but
// can't retroactively fix rows created before that existed, or rows
// created by anything that writes to the DB directly instead of going
// through that endpoint (e.g. a one-off backfill script).
//
// For each group of same-named, non-deleted foods that also share the
// exact same macro profile: keeps the one with the most FoodLog entries
// (ties broken by oldest createdAt — the "most established" row), repoints
// every other row's FoodLog entries at it, and soft-deletes the rest.
// Never touches FoodLog rows themselves — every diary entry keeps its
// id/date/mealType/grams, it just ends up pointing at one shared Food row
// instead of several duplicate ones, exactly like a manual "pick from
// library" always did.
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

  const nameGroups = new Map<string, typeof foods>();
  for (const f of foods) {
    const key = f.name.trim().toLowerCase();
    const group = nameGroups.get(key);
    if (group) group.push(f);
    else nameGroups.set(key, [f]);
  }

  const merged: { name: string; keptId: string; mergedCount: number; movedLogs: number }[] = [];
  const conflicts: {
    name: string;
    variants: { foodId: string; caloriesPer100g: number; proteinPer100g: number; carbPer100g: number; fatPer100g: number; unitLabel: string; logCount: number }[];
  }[] = [];

  for (const nameGroup of nameGroups.values()) {
    if (nameGroup.length < 2) continue;

    const macroGroups = new Map<string, typeof foods>();
    for (const f of nameGroup) {
      const key = macroKey(f);
      const group = macroGroups.get(key);
      if (group) group.push(f);
      else macroGroups.set(key, [f]);
    }

    if (macroGroups.size > 1) {
      // Same name, but not all the same macros — merging would silently
      // change what some of these logs have always shown. Report it
      // instead of guessing which variant is "right".
      conflicts.push({
        name: nameGroup[0].name,
        variants: nameGroup.map((f) => ({
          foodId: f.id,
          caloriesPer100g: f.caloriesPer100g,
          proteinPer100g: f.proteinPer100g,
          carbPer100g: f.carbPer100g,
          fatPer100g: f.fatPer100g,
          unitLabel: f.unitLabel,
          logCount: f._count.logs,
        })),
      });
      continue;
    }

    const sorted = [...nameGroup].sort((a, b) => b._count.logs - a._count.logs || a.createdAt.getTime() - b.createdAt.getTime());
    const [canonical, ...duplicates] = sorted;

    let movedLogs = 0;
    for (const dup of duplicates) {
      const result = await db.foodLog.updateMany({ where: { foodId: dup.id }, data: { foodId: canonical.id } });
      movedLogs += result.count;
      await db.food.update({ where: { id: dup.id }, data: { deletedAt: new Date() } });
    }

    merged.push({ name: canonical.name, keptId: canonical.id, mergedCount: duplicates.length, movedLogs });
  }

  return NextResponse.json({ ok: true, merged, conflicts });
}
