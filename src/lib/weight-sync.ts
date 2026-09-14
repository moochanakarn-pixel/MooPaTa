import { db } from "./db";

// After deleting a WeightLog or BodyCompositionLog row, User.weightKg (the
// figure every computeTargets call reads for BMR/TDEE/water targets) needs
// to catch up to whatever is now the most recent weight measurement —
// otherwise a mis-logged entry that gets deleted leaves a stale weight
// silently driving targets everywhere until the user happens to log a
// fresh one, with no indication anything is out of sync. Picks whichever
// of the two sources is more recent, same "regardless of which form it
// came from" rule both POST routes (/api/weight/log,
// /api/body-composition/log) already follow when writing User.weightKg —
// and leaves User.weightKg untouched when neither table has any rows left
// for this user, falling back to whatever's already there (e.g. a value
// set directly via the nutrition-profile settings form).
export async function syncWeightKgToLatestLog(userId: string): Promise<void> {
  const [latestWeightLog, latestBodyComp] = await Promise.all([
    db.weightLog.findFirst({ where: { userId }, orderBy: { loggedAt: "desc" }, select: { weightKg: true, loggedAt: true } }),
    db.bodyCompositionLog.findFirst({ where: { userId }, orderBy: { loggedAt: "desc" }, select: { weightKg: true, loggedAt: true } }),
  ]);
  const latest =
    latestWeightLog && latestBodyComp
      ? latestWeightLog.loggedAt > latestBodyComp.loggedAt
        ? latestWeightLog
        : latestBodyComp
      : (latestWeightLog ?? latestBodyComp);
  if (!latest) return;
  await db.user.update({ where: { id: userId }, data: { weightKg: latest.weightKg } });
}
