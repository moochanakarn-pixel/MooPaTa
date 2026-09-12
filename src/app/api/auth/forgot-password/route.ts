import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuthToken } from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/email";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Always returns the same generic response whether or not the email has
// an account — confirming that would let anyone probe which addresses
// are registered. Only actually sends a mail when there's a real match.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  const genericResponse: { ok: true; message: string; devToken?: string } = {
    ok: true,
    message: "ถ้ามีบัญชีนี้ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลนี้แล้ว",
  };

  if (email) {
    const user = await db.user.findUnique({ where: { email } });
    if (user && user.passwordHash) {
      const rawToken = await createAuthToken(user.id, "RESET_PASSWORD", RESET_TOKEN_TTL_MS);
      const { sent } = await sendPasswordResetEmail(email, rawToken);
      if (!sent) genericResponse.devToken = rawToken;
    }
  }

  return NextResponse.json(genericResponse);
}
