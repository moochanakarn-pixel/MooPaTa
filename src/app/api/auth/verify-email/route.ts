import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { createSession } from "@/lib/session";

// Reached by clicking the link Resend sent — confirms the email, then
// logs the user straight in (createSession is the same provider-agnostic
// helper the Strava callback uses) rather than making them separately log
// in right after proving they own the address. Works the same whether
// this account started as a fresh signup or as an existing Strava-linked
// user adding a password from Settings — either way it's just "does this
// userId now have a confirmed email".
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const appUrl = process.env.APP_BASE_URL ?? url.origin;
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${appUrl}/?error=invalid_token`);
  }

  const userId = await consumeAuthToken(token, "VERIFY_EMAIL");
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/?error=invalid_token`);
  }

  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await createSession(userId);

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
