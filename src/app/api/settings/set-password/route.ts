import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { createAuthToken } from "@/lib/auth-tokens";
import { sendVerificationEmail } from "@/lib/email";
import { isValidEmail, isValidPassword } from "@/lib/auth-validation";

const VERIFY_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Lets an existing (typically Google-only) user add a fallback
// email+password login to their *same* account — same
// emailVerifiedAt-gated flow as a fresh signup (see
// /api/auth/signup and /api/auth/verify-email), just starting from an
// already-authenticated session instead of an anonymous one. The
// password isn't usable to log in until the emailed link is clicked.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // Re-submitting the exact email that's already verified on this same
  // account means the user only wanted to change their password — the
  // settings form pre-fills the email field with it for that reason.
  // Skip the reset-and-reverify path in that case: forcing a re-verify on
  // every password change would leave password login rejected as
  // "unverified" until a fresh link is clicked, even though the address
  // itself never changed. A genuinely different (or first-time) email
  // always still resets verification below — an unverified address must
  // never be treated as confirmed just because it used to be a different
  // (verified) one.
  if (existing?.id === userId && existing.emailVerifiedAt !== null) {
    await db.user.update({ where: { id: userId }, data: { passwordHash } });
    return NextResponse.json({ ok: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
  }

  await db.user.update({ where: { id: userId }, data: { email, passwordHash, emailVerifiedAt: null } });

  const rawToken = await createAuthToken(userId, "VERIFY_EMAIL", VERIFY_TOKEN_TTL_MS);
  const { sent } = await sendVerificationEmail(email, rawToken);

  return NextResponse.json({
    ok: true,
    message: "ส่งอีเมลยืนยันแล้ว เช็คกล่องจดหมายเพื่อยืนยัน",
    ...(sent ? {} : { devToken: rawToken }),
  });
}
