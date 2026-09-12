// Read-only. MooPaTa never stores the OAuth account's email anywhere (only
// Google's providerAccountId / "sub") — so after merging two Google
// ProviderConnection rows into one user, there's no column to check which
// connection belongs to which real email. This decrypts each stored
// refresh token, uses it to get a fresh access token from Google, then
// calls Google's userinfo endpoint to ask Google directly.
//
// Usage:
//   node scripts/identify-google-connections-2026-09-13.mjs

import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "crypto";

const db = new PrismaClient();

function decryptToken(payload) {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY env var missing or wrong length (need 64 hex chars)");
  }
  const key = Buffer.from(hex, "hex");
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function fetchGoogleProfile(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars missing");
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`token refresh failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const { access_token } = await tokenRes.json();

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`userinfo fetch failed: ${userRes.status} ${await userRes.text()}`);
  }
  return userRes.json();
}

async function main() {
  const connections = await db.providerConnection.findMany({
    where: { provider: "GOOGLE" },
    include: { user: true },
  });

  if (connections.length === 0) {
    console.log("No GOOGLE provider connections found.");
  }

  for (const c of connections) {
    console.log(`connectionId: ${c.id}`);
    console.log(`  currently under userId: ${c.userId}  (name in DB: ${c.user.name ?? "(none)"})`);
    console.log(`  providerAccountId (Google sub): ${c.providerAccountId}`);
    try {
      const refreshToken = decryptToken(c.refreshTokenEnc);
      const profile = await fetchGoogleProfile(refreshToken);
      console.log(`  -> real Google email: ${profile.email ?? "(not returned)"}   real Google name: ${profile.name ?? "(none)"}`);
    } catch (err) {
      console.log(`  -> could not verify against Google: ${err.message}`);
    }
    console.log();
  }

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
