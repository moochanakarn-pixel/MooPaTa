import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthorizeUrl } from "@/lib/providers/google";
import { getSessionUserId } from "@/lib/session";

const STATE_COOKIE = "google_oauth_state";
const LINK_COOKIE = "google_oauth_link_user";

// Kicks off "Sign in with Google": stash a random CSRF state in a
// short-lived cookie, then redirect the user to Google's consent screen.
// With ?link=1 (only from the already-logged-in Settings page) it also
// stashes the current session's userId in a second cookie, so the callback
// can attach this Google identity to that same account instead of doing its
// normal find-or-create-a-login-account thing — see the callback route for
// why that distinction matters.
export async function GET(req: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  cookies().set(STATE_COOKIE, state, cookieOpts);

  if (req.nextUrl.searchParams.get("link") === "1") {
    const userId = await getSessionUserId();
    if (userId) {
      cookies().set(LINK_COOKIE, userId, cookieOpts);
    }
  } else {
    cookies().delete(LINK_COOKIE);
  }

  return NextResponse.redirect(buildGoogleAuthorizeUrl(state));
}
