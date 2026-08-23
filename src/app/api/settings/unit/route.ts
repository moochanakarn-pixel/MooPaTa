import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.unit !== "METRIC" && body.unit !== "IMPERIAL") {
    return NextResponse.json({ error: "invalid_unit" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { unitSystem: body.unit } });
  return NextResponse.json({ ok: true });
}
