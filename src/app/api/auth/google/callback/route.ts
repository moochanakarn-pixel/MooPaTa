import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeGoogleCode } from "@/lib/providers/google";
import { createSession } from "@/lib/session";

const STATE_COOKIE = "google_oauth_state";

// Find-or-create by providerAccountId — a Google `sub` maps to at most one
// User, reused across repeat logins rather than creating a new account each
// time. Note: this always starts a fresh login (or creates a new account) —
// it does not link Google to whatever session might already be active. So
// signing in with Google while already logged in via email switches to (or
// creates) the Google-linked account rather than merging the two — see
// scripts/merge-accounts-2026-09-13.mjs for fixing an account that's split
// across two provider logins like this.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const appUrl = process.env.APP_BASE_URL ?? url.origin;

  if (error) {
    return NextResponse.redirect(`${appUrl}/?error=google_denied`);
  }

  const expectedState = cookies().get(STATE_COOKIE)?.value;
  cookies().delete(STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/?error=invalid_state`);
  }

  const { tokens, profile } = await exchangeGoogleCode(code);
  if (!tokens.providerAccountId) {
    return NextResponse.redirect(`${appUrl}/?error=google_no_profile`);
  }

  const existing = await db.providerConnection.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: tokens.providerAccountId,
      },
    },
  });

  const user = existing
    ? await db.user.update({
        where: { id: existing.userId },
        data: { name: profile.name, avatarUrl: profile.avatarUrl },
      })
    : await db.user.create({
        data: { name: profile.name, avatarUrl: profile.avatarUrl },
      });

  await db.providerConnection.upsert({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: tokens.providerAccountId,
      },
    },
    update: {
      accessTokenEnc: encryptToken(tokens.accessToken),
      refreshTokenEnc: encryptToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
    create: {
      provider: "GOOGLE",
      providerAccountId: tokens.providerAccountId,
      accessTokenEnc: encryptToken(tokens.accessToken),
      refreshTokenEnc: encryptToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      userId: user.id,
    },
  });

  await createSession(user.id);

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
