import { Resend } from "resend";

// Resend's free tier (100/day, 3,000/month, no card) is comfortably
// enough for a small-group app's verification/reset volume — this whole
// feature exists so login doesn't have to depend on Strava's own paid API
// access, so it shouldn't turn around and require a paid mail service.
//
// Unlike SESSION_SECRET/TOKEN_ENCRYPTION_KEY (required for the app to
// function at all), a missing RESEND_API_KEY degrades gracefully instead
// of throwing — email delivery is optional infrastructure here. Each
// send*Email function below returns whether it actually sent, and every
// caller (signup/forgot-password/set-password routes) includes the raw
// token directly in its API response whenever it didn't, so the flow
// stays fully testable/usable before Resend is configured. Once a real
// key is set, this return value naturally flips to true and no route
// leaks a token again.
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function appBaseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) throw new Error("APP_BASE_URL is not set");
  return url;
}

function fromAddress(): string {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");
  return from;
}

export async function sendVerificationEmail(to: string, rawToken: string): Promise<{ sent: boolean }> {
  const link = `${appBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const resend = getResend();
  if (!resend) {
    console.log(`[email disabled: no RESEND_API_KEY] verification link for ${to}: ${link}`);
    return { sent: false };
  }
  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: "ยืนยันอีเมลของคุณ - MooPaTa",
    html: `<p>กดลิงก์นี้เพื่อยืนยันอีเมลและเข้าสู่ระบบ MooPaTa:</p><p><a href="${link}">${link}</a></p><p>ลิงก์นี้ใช้ได้ 1 ชั่วโมง ถ้าไม่ได้เป็นคนขอ ไม่ต้องทำอะไรเพิ่ม</p>`,
  });
  return { sent: true };
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<{ sent: boolean }> {
  const link = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const resend = getResend();
  if (!resend) {
    console.log(`[email disabled: no RESEND_API_KEY] password-reset link for ${to}: ${link}`);
    return { sent: false };
  }
  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: "ตั้งรหัสผ่านใหม่ - MooPaTa",
    html: `<p>กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:</p><p><a href="${link}">${link}</a></p><p>ลิงก์นี้ใช้ได้ 30 นาที ถ้าไม่ได้เป็นคนขอ ไม่ต้องทำอะไรเพิ่ม รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>`,
  });
  return { sent: true };
}
