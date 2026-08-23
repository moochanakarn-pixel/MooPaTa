import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeStravaCode } from "@/lib/providers/strava";
import { createSession } from "@/lib/session";

const STATE_COOKIE = "strava_oauth_state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const appUrl = process.env.APP_BASE_URL ?? url.origin;

  if (error) {
    // User declined access on Strava's screen.
    return NextResponse.redirect(`${appUrl}/?error=strava_denied`);
  }

  const expectedState = cookies().get(STATE_COOKIE)?.value;
  cookies().delete(STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/?error=invalid_state`);
  }

  const { tokens, athlete } = await exchangeStravaCode(code);
  if (!tokens.providerAccountId) {
    return NextResponse.redirect(`${appUrl}/?error=strava_no_athlete`);
  }

  const existing = await db.providerConnection.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "STRAVA",
        providerAccountId: tokens.providerAccountId,
      },
    },
  });

  const user = existing
    ? await db.user.update({
        where: { id: existing.userId },
        data: { name: athlete.name, avatarUrl: athlete.avatarUrl },
      })
    : await db.user.create({
        data: { name: athlete.name, avatarUrl: athlete.avatarUrl },
      });

  await db.providerConnection.upsert({
    where: {
      provider_providerAccountId: {
        provider: "STRAVA",
        providerAccountId: tokens.providerAccountId,
      },
    },
    update: {
      accessTokenEnc: encryptToken(tokens.accessToken),
      refreshTokenEnc: encryptToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    },
    create: {
      provider: "STRAVA",
      providerAccountId: tokens.providerAccountId,
      accessTokenEnc: encryptToken(tokens.accessToken),
      refreshTokenEnc: encryptToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      userId: user.id,
    },
  });

  await createSession(user.id);

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
