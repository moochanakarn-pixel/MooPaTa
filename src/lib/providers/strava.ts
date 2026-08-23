import type { NormalizedActivity, OAuthTokenSet } from "./types";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

function config() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REDIRECT_URI env vars");
  }
  return { clientId, clientSecret, redirectUri };
}

// Step 1: build the URL that sends the user to Strava to authorize MooPaTa.
export function buildStravaAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });
  return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number; firstname?: string; lastname?: string; profile?: string };
}

// Step 2: exchange the authorization code from the callback for tokens.
export async function exchangeStravaCode(code: string): Promise<{
  tokens: OAuthTokenSet;
  athlete: { id: number; name?: string; avatarUrl?: string };
}> {
  const { clientId, clientSecret } = config();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as StravaTokenResponse;
  return {
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
      providerAccountId: String(data.athlete?.id ?? ""),
    },
    athlete: {
      id: data.athlete?.id ?? 0,
      name: [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(" ") || undefined,
      avatarUrl: data.athlete?.profile,
    },
  };
}

// Refresh an expired/expiring access token using the stored refresh token.
export async function refreshStravaToken(refreshToken: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret } = config();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as StravaTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(data.expires_at * 1000),
    providerAccountId: "",
  };
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  moving_time: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  calories?: number;
}

// Pull recent activities for the athlete. `afterUnix` lets us do incremental
// syncs by only asking for activities newer than the last one we have.
export async function fetchStravaActivities(
  accessToken: string,
  afterUnix?: number
): Promise<NormalizedActivity[]> {
  const params = new URLSearchParams({ per_page: "50" });
  if (afterUnix) params.set("after", String(afterUnix));

  const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava activities fetch failed: ${res.status} ${await res.text()}`);
  }
  const activities = (await res.json()) as StravaActivity[];

  return activities.map((a) => ({
    providerActId: String(a.id),
    type: a.sport_type ?? a.type,
    name: a.name,
    startedAt: new Date(a.start_date),
    durationSec: a.moving_time,
    distanceMeters: a.distance,
    elevationGainM: a.total_elevation_gain,
    avgHeartRate: a.average_heartrate,
    calories: a.calories,
    raw: a,
  }));
}
