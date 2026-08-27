import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("push_not_configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Sends one push notification to one subscription. A 404/410 response means
// the push service itself has permanently invalidated the subscription
// (browser data cleared, extension uninstalled, etc.) — the caller is
// expected to delete that row so it stops trying every future run instead
// of accumulating dead subscriptions forever.
export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; expired: boolean }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    const statusCode = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : null;
    const expired = statusCode === 404 || statusCode === 410;
    if (!expired) console.error("Push send failed", err);
    return { ok: false, expired };
  }
}

// Sends to every subscription for one user, pruning any that came back
// expired. Used by the water-reminder cron — a user can have several
// devices subscribed, and one going stale shouldn't block the others.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  const expiredIds: string[] = [];
  for (const sub of subs) {
    const result = await sendPush(sub, payload);
    if (result.ok) sent++;
    else if (result.expired) expiredIds.push(sub.id);
  }
  if (expiredIds.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
  }
  return sent;
}
