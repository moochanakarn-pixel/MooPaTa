import { NextRequest, NextResponse } from "next/server";
import { buildHeatmapDays, computeStreaks } from "@/app/dashboard/activity-heatmap";
import {
  COUNT_MILESTONES,
  DISTANCE_MILESTONES_KM,
  LIFT_VOLUME_MILESTONES_KG,
  STREAK_MILESTONES,
  newlyCrossedMilestones,
  type Celebration,
} from "@/lib/achievements";
import {
  INTENSITIES,
  MAX_DURATION_MIN,
  computeAvgSpeedMs,
  isFutureDate,
  optionalNonNegative,
  optionalNotes,
  optionalRpe,
  parseExercises,
} from "@/lib/activity-validation";
import { db } from "@/lib/db";
import { getExerciseStats, getTotalLiftVolumeKg } from "@/lib/exercise-stats";
import { getSessionUserId } from "@/lib/session";

// Same window achievements/page.tsx uses for its streak milestone — a
// celebration here has to agree with what that page would show, since it's
// the same STREAK_MILESTONES ladder being diffed.
const HEATMAP_WEEKS_BACK = 53;

// Logs an activity Strava doesn't track (football, badminton, ...) into the
// same Activity table synced activities use — provider=MANUAL with a random
// providerActId satisfies the (provider, providerActId) unique constraint.
// This is what makes it show up for free everywhere Activity already flows:
// the dashboard list, records, heatmap/streaks, compare, and the water/macro
// activity-bonus calculations. See PATCH /api/activity/[id] for editing one
// of these after the fact.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const type = typeof body.type === "string" ? body.type.trim().slice(0, 50) : "";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 200) : null;
  const durationMin = Number(body.durationMin);
  const intensity = INTENSITIES.includes(body.intensity) ? body.intensity : null;
  const startedAt = typeof body.startedAt === "string" ? new Date(body.startedAt) : new Date();
  const distanceKm = optionalNonNegative(body.distanceKm);
  const avgHeartRate = optionalNonNegative(body.avgHeartRate);
  const maxHeartRate = optionalNonNegative(body.maxHeartRate);
  const calories = optionalNonNegative(body.calories);
  const avgCadence = optionalNonNegative(body.avgCadence);
  // Already converted to m/s client-side (from a pace or km/h input, per
  // activity type — see log-activity-form.tsx) — this route just passes it
  // through, the same as the rest of the optional numeric fields.
  const maxSpeedMs = optionalNonNegative(body.maxSpeedMs);
  const rpe = optionalRpe(body.rpe);
  const notes = optionalNotes(body.notes);
  const exercises = parseExercises(body.exercises);

  if (!type) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > MAX_DURATION_MIN) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  if (isFutureDate(startedAt)) {
    return NextResponse.json({ error: "future_date" }, { status: 400 });
  }
  if ([distanceKm, avgHeartRate, maxHeartRate, calories, avgCadence, maxSpeedMs, rpe].some((n) => n !== null && Number.isNaN(n))) {
    return NextResponse.json({ error: "invalid_optional_field" }, { status: 400 });
  }
  if (exercises === null) {
    return NextResponse.json({ error: "invalid_exercises" }, { status: 400 });
  }

  // Achievements/exercise PRs are purely derived (recomputed fresh from the
  // DB everywhere they're shown — nothing is ever marked "unlocked" in the
  // database), so the only way to tell this specific submission just
  // crossed a milestone is to snapshot the relevant totals before the write
  // and diff them against the same totals after. exerciseStats is skipped
  // entirely when nothing in this submission could set a PR — it's the one
  // query here expensive enough (a full scan of every ExerciseSet the user
  // has ever logged) to be worth not running on every plain run/ride log.
  const heatmapSince = new Date(Date.now() - HEATMAP_WEEKS_BACK * 7 * 24 * 60 * 60 * 1000);
  const [beforeAgg, beforeHeatmapRows, beforeLiftVolumeKg, beforeExerciseStats] = await Promise.all([
    db.activity.aggregate({ where: { userId }, _count: { _all: true }, _sum: { distanceMeters: true } }),
    db.activity.findMany({ where: { userId, startedAt: { gte: heatmapSince } }, select: { startedAt: true, distanceMeters: true } }),
    getTotalLiftVolumeKg(userId),
    exercises.length > 0 ? getExerciseStats(userId) : Promise.resolve([]),
  ]);
  const beforeKm = (beforeAgg._sum.distanceMeters ?? 0) / 1000;
  const beforeCount = beforeAgg._count._all;
  const beforeStreak = computeStreaks(buildHeatmapDays(beforeHeatmapRows)).longest;
  // Keyed the same way getExerciseStats itself folds names (trimmed,
  // lowercased) — absent from the map means this exact name has never had a
  // weighted set logged before, same as an explicit `null` PR.
  const priorPrByName = new Map(beforeExerciseStats.map((s) => [s.name.trim().toLowerCase(), s.prWeightKg]));

  const activity = await db.activity.create({
    data: {
      userId,
      provider: "MANUAL",
      providerActId: crypto.randomUUID(),
      type,
      name,
      startedAt,
      durationSec: Math.round(durationMin * 60),
      distanceMeters: distanceKm !== null ? distanceKm * 1000 : null,
      avgSpeedMs: computeAvgSpeedMs(distanceKm, durationMin),
      maxSpeedMs,
      avgHeartRate,
      maxHeartRate,
      calories,
      avgCadence,
      rpe,
      notes,
      raw: intensity ? { manualIntensity: intensity } : {},
      exercises: {
        create: exercises.map((ex, i) => ({
          name: ex.name,
          order: i,
          notes: ex.notes,
          sets: {
            create: ex.sets.map((s, j) => ({ order: j, reps: s.reps, weightKg: s.weightKg, rpe: s.rpe })),
          },
        })),
      },
    },
  });

  // "After" re-queries the same shapes rather than computing them by hand
  // from the before-snapshot + this submission — the streak in particular
  // isn't a simple +1 (today might already have had an activity, or
  // `startedAt` could be backdated into the middle of the heatmap window),
  // and a personal app's activity table is small enough that a second pass
  // of the same cheap queries is simpler to trust than re-deriving it.
  const [afterAgg, afterHeatmapRows, afterLiftVolumeKg] = await Promise.all([
    db.activity.aggregate({ where: { userId }, _count: { _all: true }, _sum: { distanceMeters: true } }),
    db.activity.findMany({ where: { userId, startedAt: { gte: heatmapSince } }, select: { startedAt: true, distanceMeters: true } }),
    getTotalLiftVolumeKg(userId),
  ]);
  const afterKm = (afterAgg._sum.distanceMeters ?? 0) / 1000;
  const afterCount = afterAgg._count._all;
  const afterStreak = computeStreaks(buildHeatmapDays(afterHeatmapRows)).longest;

  const celebrations: Celebration[] = [
    ...newlyCrossedMilestones(DISTANCE_MILESTONES_KM, beforeKm, afterKm).map((value): Celebration => ({ type: "distance", value })),
    ...newlyCrossedMilestones(COUNT_MILESTONES, beforeCount, afterCount).map((value): Celebration => ({ type: "count", value })),
    ...newlyCrossedMilestones(STREAK_MILESTONES, beforeStreak, afterStreak).map((value): Celebration => ({ type: "streak", value })),
    ...newlyCrossedMilestones(LIFT_VOLUME_MILESTONES_KG, beforeLiftVolumeKg, afterLiftVolumeKg).map(
      (value): Celebration => ({ type: "liftVolume", value })
    ),
  ];

  // New exercise PRs come straight from what was just submitted (no need to
  // re-query exercise stats after the write) — compare each exercise's own
  // heaviest submitted set against its prior all-time PR from the
  // before-snapshot above. A tie doesn't count as "new."
  for (const ex of exercises) {
    let maxWeight: number | null = null;
    let repsAtMax = 0;
    for (const s of ex.sets) {
      if (s.weightKg !== null && (maxWeight === null || s.weightKg > maxWeight)) {
        maxWeight = s.weightKg;
        repsAtMax = s.reps;
      }
    }
    if (maxWeight === null) continue;
    const prior = priorPrByName.get(ex.name.trim().toLowerCase()) ?? null;
    if (prior === null || maxWeight > prior) {
      celebrations.push({ type: "exercisePr", value: maxWeight, exerciseName: ex.name, reps: repsAtMax });
    }
  }

  return NextResponse.json({ ok: true, id: activity.id, celebrations });
}
