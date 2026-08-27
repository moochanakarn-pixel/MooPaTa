import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Toggles "taken today" for one supplement — a SupplementLog row existing
// for today is the source of truth the checklist reflects, so this either
// creates or deletes today's row rather than tracking a boolean anywhere.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const supplement = await db.supplement.findUnique({ where: { id: params.id } });
  if (!supplement || supplement.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existing = await db.supplementLog.findFirst({
    where: { userId, supplementId: params.id, takenAt: { gte: todayStart } },
  });

  if (existing) {
    await db.supplementLog.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, taken: false });
  }

  await db.supplementLog.create({ data: { userId, supplementId: params.id } });
  return NextResponse.json({ ok: true, taken: true });
}
