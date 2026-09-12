import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthorizeUrl } from "@/lib/providers/google";

const STATE_COOKIE = "google_oauth_state";

// Kicks off "Sign in with Google" — same CSRF-state-cookie + redirect
// pattern as src/app/api/auth/strava/connect/route.ts, own cookie name.
export async function GET() {
  const state = randomBytes(16).toString("hex");

  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildGoogleAuthorizeUrl(state));
}
