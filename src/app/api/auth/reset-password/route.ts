import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { createSession } from "@/lib/session";
import { isValidPassword } from "@/lib/auth-validation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const newPassword = body.newPassword;

  if (!token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (!isValidPassword(newPassword)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const userId = await consumeAuthToken(token, "RESET_PASSWORD");
  if (!userId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });
  await createSession(userId);

  return NextResponse.json({ ok: true });
}
