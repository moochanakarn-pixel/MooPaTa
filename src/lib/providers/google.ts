import type { OAuthTokenSet } from "./types";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI env vars");
  }
  return { clientId, clientSecret, redirectUri };
}

// Step 1: build the URL that sends the user to Google's consent screen.
// access_type=offline + prompt=consent guarantees a refresh_token comes
// back even on a repeat login — ProviderConnection.refreshTokenEnc is a
// required column, and this keeps a Google row shaped the same as a
// Strava one rather than needing a special empty-string case (MooPaTa
// never actually needs to use it, since this is login-only, not an
// ongoing data sync the way Strava is).
export function buildGoogleAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds from now
  scope?: string;
}

interface GoogleUserinfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

// Step 2: exchange the authorization code for tokens, then fetch the
// profile from Google's userinfo endpoint (an authenticated API call we
// trust, same as Strava's own athlete profile) rather than verifying the
// id_token JWT's signature ourselves.
export async function exchangeGoogleCode(code: string): Promise<{
  tokens: OAuthTokenSet;
  profile: { id: string; name?: string; avatarUrl?: string; email?: string };
}> {
  const { clientId, clientSecret, redirectUri } = config();
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`Google userinfo fetch failed: ${userRes.status} ${await userRes.text()}`);
  }
  const profile = (await userRes.json()) as GoogleUserinfo;

  if (!tokenData.refresh_token) {
    // Shouldn't happen given access_type=offline&prompt=consent above,
    // but the column is NOT NULL — fail loudly rather than writing a
    // silently-broken row.
    throw new Error("Google did not return a refresh_token");
  }

  return {
    tokens: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      scope: tokenData.scope,
      providerAccountId: profile.sub,
    },
    profile: {
      id: profile.sub,
      name: profile.name,
      avatarUrl: profile.picture,
      email: profile.email,
    },
  };
}
