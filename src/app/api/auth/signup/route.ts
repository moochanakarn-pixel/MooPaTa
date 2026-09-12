import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createAuthToken } from "@/lib/auth-tokens";
import { sendVerificationEmail } from "@/lib/email";
import { isValidEmail, isValidPassword } from "@/lib/auth-validation";

const VERIFY_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Creates the account but does NOT log the caller in yet — emailVerifiedAt
// stays null until they click the link Resend just sent, same gate
// /api/auth/login enforces regardless of whether the account started here
// or via /api/settings/set-password on an existing Strava-linked user.
export async function POST(req: NextRequest) {
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
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { email, passwordHash } });

  const rawToken = await createAuthToken(user.id, "VERIFY_EMAIL", VERIFY_TOKEN_TTL_MS);
  const { sent } = await sendVerificationEmail(email, rawToken);

  return NextResponse.json({
    ok: true,
    message: "ส่งอีเมลยืนยันแล้ว เช็คกล่องจดหมายเพื่อเข้าสู่ระบบ",
    // Only present when Resend isn't configured yet (see src/lib/email.ts)
    // — the token that would otherwise only ever exist in the emailed
    // link, so the flow stays testable before a real key is set up.
    ...(sent ? {} : { devToken: rawToken }),
  });
}
