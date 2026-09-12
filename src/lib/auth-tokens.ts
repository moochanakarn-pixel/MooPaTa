import { randomBytes, createHash } from "crypto";
import { db } from "./db";
import type { AuthTokenType } from "@prisma/client";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Issues a one-time-use link token (for email verification or password
// reset) — only the token's hash is ever persisted, so a DB leak alone
// can never produce something usable, same principle as
// TOKEN_ENCRYPTION_KEY/SESSION_SECRET never being stored reversibly.
// Returns the raw token, which only ever exists in the emailed link.
export async function createAuthToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  await db.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return rawToken;
}

// Validates + marks used in one step (never returns the same token as
// valid twice) — returns the userId it belonged to, or null if the token
// is unknown, wrong type, expired, or already used. The claim itself is a
// single conditional UPDATE (only succeeds while usedAt is still null),
// same atomic-claim shape as src/app/api/cron/water-reminder/route.ts
// uses for its own send-once guarantee — so two near-simultaneous uses of
// the same link (a double click, a mail client prefetching it) can't both
// win.
export async function consumeAuthToken(rawToken: string, type: AuthTokenType): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const token = await db.authToken.findUnique({ where: { tokenHash } });
  if (!token || token.type !== type || token.usedAt !== null || token.expiresAt < new Date()) {
    return null;
  }
  const claim = await db.authToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claim.count === 0) return null;
  return token.userId;
}
