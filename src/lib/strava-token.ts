import { ProviderConnection } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshStravaToken } from "@/lib/providers/strava";

// Returns a usable Strava access token for this connection, refreshing (and
// persisting the refreshed tokens) first if the current one is expired or
// about to expire. Shared by the sync route and the on-demand detail-fetch
// route so both refresh the same way.
export async function getValidStravaAccessToken(connection: ProviderConnection): Promise<string> {
  if (connection.expiresAt.getTime() >= Date.now() + 5 * 60 * 1000) {
    return decryptToken(connection.accessTokenEnc);
  }

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
}
