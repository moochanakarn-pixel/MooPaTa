import type { NormalizedActivity, OAuthTokenSet } from "./types";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

// Thrown when Strava responds 429 (200 req/15min or 2,000/day exceeded), so
// callers can show a friendly "try again later" message instead of a raw
// fetch error.
export class StravaRateLimitError extends Error {
  retryAfterSec?: number;
  constructor(retryAfterSec?: number) {
    super("Strava API rate limit exceeded");
    this.name = "StravaRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

async function stravaFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    throw new StravaRateLimitError(retryAfter ? Number(retryAfter) : undefined);
  }
  return res;
}

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
  const res = await stravaFetch(STRAVA_TOKEN_URL, {
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
  const res = await stravaFetch(STRAVA_TOKEN_URL, {
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
  elev_high?: number;
  elev_low?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  max_speed?: number;
  average_cadence?: number;
  average_watts?: number;
  kilojoules?: number;
  suffer_score?: number;
  calories?: number;
  kudos_count?: number;
  achievement_count?: number;
  pr_count?: number;
  comment_count?: number;
  gear_id?: string;
  timezone?: string;
  start_latlng?: [number, number] | null;
}

// Pull recent activities for the athlete. `afterUnix` lets us do incremental
// syncs by only asking for activities newer than the last one we have.
export async function fetchStravaActivities(
  accessToken: string,
  afterUnix?: number
): Promise<NormalizedActivity[]> {
  const params = new URLSearchParams({ per_page: "50" });
  if (afterUnix) params.set("after", String(afterUnix));

  const res = await stravaFetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
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
    elevHighM: a.elev_high,
    elevLowM: a.elev_low,
    avgHeartRate: a.average_heartrate,
    maxHeartRate: a.max_heartrate,
    avgSpeedMs: a.average_speed,
    maxSpeedMs: a.max_speed,
    avgCadence: a.average_cadence,
    avgWatts: a.average_watts,
    kilojoules: a.kilojoules,
    sufferScore: a.suffer_score,
    calories: a.calories,
    kudosCount: a.kudos_count,
    achievementCount: a.achievement_count,
    prCount: a.pr_count,
    commentCount: a.comment_count,
    gearId: a.gear_id,
    timezone: a.timezone,
    startLat: a.start_latlng?.[0],
    startLng: a.start_latlng?.[1],
    raw: a,
  }));
}

// Every activity id currently on Strava for this athlete, across all pages.
// Used to reconcile deletions: an activity we have stored but that no longer
// shows up here was removed on Strava's side and should be removed here too.
export async function fetchAllStravaActivityIds(accessToken: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const maxPages = 50; // 50 * 200 = 10,000 activities, generous safety cap

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ per_page: "200", page: String(page) });
    const res = await stravaFetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Strava activities fetch failed: ${res.status} ${await res.text()}`);
    }
    const batch = (await res.json()) as { id: number }[];
    for (const a of batch) ids.add(String(a.id));
    if (batch.length < 200) break;
  }

  return ids;
}

// Revokes MooPaTa's access on Strava's side too, so the app disappears from
// the athlete's "My Apps" list instead of just being forgotten locally.
export async function deauthorizeStrava(accessToken: string): Promise<void> {
  await stravaFetch(STRAVA_DEAUTHORIZE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
