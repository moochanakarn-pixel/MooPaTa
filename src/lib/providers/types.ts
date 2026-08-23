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
  elevHighM?: number;
  elevLowM?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgSpeedMs?: number;
  maxSpeedMs?: number;
  avgCadence?: number;
  avgWatts?: number;
  kilojoules?: number;
  sufferScore?: number;
  calories?: number;
  kudosCount?: number;
  achievementCount?: number;
  prCount?: number;
  commentCount?: number;
  gearId?: string;
  timezone?: string;
  startLat?: number;
  startLng?: number;
  raw: unknown;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
  providerAccountId: string;
}
