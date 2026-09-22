import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
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
  return NextResponse.json({ ok: true, id: activity.id });
}
