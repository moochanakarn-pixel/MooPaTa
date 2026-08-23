import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildStravaAuthorizeUrl } from "@/lib/providers/strava";

const STATE_COOKIE = "strava_oauth_state";

// Kicks off the "Login with Strava" flow: stash a random CSRF state in a
// short-lived cookie, then redirect the user to Strava's authorize screen.
export async function GET() {
  const state = randomBytes(16).toString("hex");

  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildStravaAuthorizeUrl(state));
}
