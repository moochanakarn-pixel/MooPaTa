import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const log = await db.waterLog.findUnique({ where: { id: params.id } });
  if (!log || log.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.waterLog.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
