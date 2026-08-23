// Shared shape that every provider adapter must normalize its activities into,
// so the rest of the app (DB writes, dashboard, stats) never branches on provider.
export interface NormalizedActivity {
  providerActId: string;
  type: string;
  name?: string;
  startedAt: Date;
  durationSec: number;
  distanceMeters?: number;
  elevationGainM?: number;
  avgHeartRate?: number;
  calories?: number;
  raw: unknown;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
  providerAccountId: string;
}
