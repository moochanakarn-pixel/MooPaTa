import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const timeLabel = typeof body.timeLabel === "string" && body.timeLabel.trim() ? body.timeLabel.trim().slice(0, 50) : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  if (!name) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const supplement = await db.supplement.create({ data: { userId, name, timeLabel, note } });
  return NextResponse.json({ ok: true, id: supplement.id });
}
