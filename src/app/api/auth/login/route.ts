import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

// Password login is guessable in a way Strava OAuth never was, so this
// needs its own brute-force guard — a simple attempt counter + timed
// lockout on the User row itself (same "just add a field" shape as every
// other per-user throttle already in schema.prisma, e.g.
// lastWaterReminderSentAt) rather than pulling in a separate rate-limit
// service for what's a small-group app.
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Same generic-looking failure for "no such account" and "wrong
  // password" — telling them apart would confirm which emails have
  // accounts.
  const genericFailure = () => NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  if (!email || !password) return genericFailure();

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return genericFailure();

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: "account_locked" }, { status: 423 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: failedLoginCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : user.lockedUntil,
      },
    });
    return genericFailure();
  }

  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
