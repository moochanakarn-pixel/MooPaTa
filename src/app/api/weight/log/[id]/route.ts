import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { syncWeightKgToLatestLog } from "@/lib/weight-sync";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const log = await db.weightLog.findUnique({ where: { id: params.id } });
  if (!log || log.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.weightLog.delete({ where: { id: params.id } });
  // The deleted row may have been the one User.weightKg was last set from
  // (see /api/weight/log's POST comment) — resync to whatever's now the
  // most recent measurement instead of leaving a stale weight in place.
  await syncWeightKgToLatestLog(userId);
  return NextResponse.json({ ok: true });
}
