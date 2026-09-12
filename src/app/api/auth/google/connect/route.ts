import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthorizeUrl } from "@/lib/providers/google";

const STATE_COOKIE = "google_oauth_state";

// Kicks off "Sign in with Google": stash a random CSRF state in a
// short-lived cookie, then redirect the user to Google's consent screen.
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
