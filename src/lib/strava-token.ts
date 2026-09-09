import { ProviderConnection } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshStravaToken } from "@/lib/providers/strava";

// Strava rotates the refresh token on every use — an old one stops working
// the moment a newer one is issued. Two overlapping requests for the same
// connection (a cron sync tick + a manual "ซิงก์" click, or cron overlapping
// itself, or the on-demand detail-fetch route racing sync) could otherwise
// both read the same stale refresh token and both call refreshStravaToken
// with it: the loser's call fails (the token it sent was already
// invalidated by the winner), and win-order determines which resulting
// token pair actually lands in the DB. Deduping concurrent refreshes for
// the same connection into a single in-flight promise closes that within
// this process (the only one running this app).
const inFlightRefreshes = new Map<string, Promise<string>>();

// Returns a usable Strava access token for this connection, refreshing (and
// persisting the refreshed tokens) first if the current one is expired or
// about to expire. Shared by the sync route and the on-demand detail-fetch
// route so both refresh the same way.
export async function getValidStravaAccessToken(connection: ProviderConnection): Promise<string> {
  if (connection.expiresAt.getTime() >= Date.now() + 5 * 60 * 1000) {
    return decryptToken(connection.accessTokenEnc);
  }

  const inFlight = inFlightRefreshes.get(connection.id);
  if (inFlight) return inFlight;

  const refreshPromise = (async () => {
    try {
      const refreshToken = decryptToken(connection.refreshTokenEnc);
      const refreshed = await refreshStravaToken(refreshToken);
      await db.providerConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEnc: encryptToken(refreshed.accessToken),
          refreshTokenEnc: encryptToken(refreshed.refreshToken),
          expiresAt: refreshed.expiresAt,
        },
      });
      return refreshed.accessToken;
    } finally {
      inFlightRefreshes.delete(connection.id);
    }
  })();
  inFlightRefreshes.set(connection.id, refreshPromise);
  return refreshPromise;
}
