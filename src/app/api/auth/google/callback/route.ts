import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeGoogleCode } from "@/lib/providers/google";
import { createSession, getSessionUserId } from "@/lib/session";

const STATE_COOKIE = "google_oauth_state";
const LINK_COOKIE = "google_oauth_link_user";

// Two modes, distinguished by whether the connect route left a LINK_COOKIE:
//
// - Normal login (no link cookie, e.g. the landing page's "Sign in with
//   Google" button): find-or-create by providerAccountId — a Google `sub`
//   maps to at most one User, reused across repeat logins rather than
//   creating a new account each time.
// - Link mode (Settings' "เชื่อมบัญชี Google" button sets ?link=1): attach
//   this Google identity to the *already-logged-in* session's user instead,
//   so it stops creating/switching to a separate account. The old
//   find-or-create-only behavior is why scripts/merge-accounts-2026-09-13.mjs
//   had to exist — that script (and its siblings) still fix any account
//   that's already split across two provider logins from before this
//   existed, but new connections via Settings no longer split accounts.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const appUrl = process.env.APP_BASE_URL ?? url.origin;
  const settingsUrl = `${appUrl}/dashboard/settings`;

  const linkUserId = cookies().get(LINK_COOKIE)?.value ?? null;
  cookies().delete(LINK_COOKIE);

  if (error) {
    return NextResponse.redirect(linkUserId ? `${settingsUrl}?googleError=denied` : `${appUrl}/?error=google_denied`);
  }

  const expectedState = cookies().get(STATE_COOKIE)?.value;
  cookies().delete(STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      linkUserId ? `${settingsUrl}?googleError=invalid_state` : `${appUrl}/?error=invalid_state`
    );
  }

  const { tokens, profile } = await exchangeGoogleCode(code);
  if (!tokens.providerAccountId) {
    return NextResponse.redirect(
      linkUserId ? `${settingsUrl}?googleError=no_profile` : `${appUrl}/?error=google_no_profile`
    );
  }

  const existing = await db.providerConnection.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: tokens.providerAccountId,
      },
    },
  });

  if (linkUserId) {
    // Confirm the session that started this link is still the one that's
    // finishing it — it may have logged out or switched accounts in another
    // tab while the Google consent screen was open.
    const currentUserId = await getSessionUserId();
    if (currentUserId !== linkUserId) {
      return NextResponse.redirect(`${settingsUrl}?googleError=session_changed`);
    }

    if (existing && existing.userId !== linkUserId) {
      // This Google identity is already linked to a *different* MooPaTa
      // account — attaching it here too would leave one Google identity
      // pointing at two Users, which nothing in the app expects. Refuse
      // rather than silently reassigning it; scripts/merge-accounts-*.mjs
      // is the deliberate, reviewed way to actually merge two accounts.
      return NextResponse.redirect(`${settingsUrl}?googleError=linked_elsewhere`);
    }

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
        userId: linkUserId,
      },
    });

    return NextResponse.redirect(`${settingsUrl}?googleLinked=1`);
  }

  // Only fill name/avatarUrl from Google on first connect (account
  // creation) — an existing user may have set a custom name/avatar since
  // (src/app/api/settings/profile, src/app/api/avatar), and overwriting
  // those on every subsequent login would silently revert that choice
  // back to whatever Google reports, contradicting the override this
  // feature is meant to allow.
  const user = existing
    ? await db.user.findUniqueOrThrow({ where: { id: existing.userId } })
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
