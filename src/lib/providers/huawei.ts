// Huawei Health Kit adapter — placeholder pending Health Kit approval on
// HUAWEI Developers (data scope request + review, sandbox capped at 100 users
// until fully approved). Mirrors the strava.ts shape so wiring it in later is
// a drop-in: implement these three functions against the Health Kit
// cloud-side OAuth2 + Data API, then add HUAWEI_HEALTH branches next to the
// STRAVA ones in the API routes and sync logic.
//
// Docs: https://developer.huawei.com/consumer/en/doc/hmscore-guides/access-process-0000001624467736
import type { NormalizedActivity, OAuthTokenSet } from "./types";

export function buildHuaweiAuthorizeUrl(_state: string): string {
  throw new Error("Huawei Health integration not yet enabled — awaiting Health Kit approval");
}

export async function exchangeHuaweiCode(_code: string): Promise<{
  tokens: OAuthTokenSet;
  athlete: { id: string; name?: string };
}> {
  throw new Error("Huawei Health integration not yet enabled — awaiting Health Kit approval");
}

export async function fetchHuaweiActivities(
  _accessToken: string,
  _afterUnix?: number
): Promise<NormalizedActivity[]> {
  throw new Error("Huawei Health integration not yet enabled — awaiting Health Kit approval");
}
