import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const MAX_NAME_LENGTH = 60;

// Auto-filled from Google's profile on connect for a Google-linked account
// — an email/password account (see "ระบบ login") has nothing to inherit a
// name from, so this is the only way for one to ever set it. Works for a
// Google-linked account too, as a manual override.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { name } });
  return NextResponse.json({ ok: true });
}
