import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  INTENSITIES,
  MAX_DURATION_MIN,
  computeAvgSpeedMs,
  optionalNonNegative,
  optionalNotes,
  optionalRpe,
  parseExercises,
} from "@/lib/activity-validation";

// Edits a manually-logged activity in place — restricted to provider:
// "MANUAL" because this form only knows the manual field set (type/duration/
// distance/HR/calories/exercises); a Strava-synced activity carries richer
// fields (GPS route, splits, kudos, ...) this form has no way to preserve or
// meaningfully edit, so it stays read-only/delete-only instead of silently
// dropping that data on save. Same validation as POST /api/activity/manual
// (src/lib/activity-validation.ts) since it's the same request shape.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const existing = await db.activity.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.provider !== "MANUAL") {
    return NextResponse.json({ error: "not_editable" }, { status: 403 });
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
  // Already converted to m/s client-side — see POST /api/activity/manual's
  // comment on the same field.
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
  if ([distanceKm, avgHeartRate, maxHeartRate, calories, avgCadence, maxSpeedMs, rpe].some((n) => n !== null && Number.isNaN(n))) {
    return NextResponse.json({ error: "invalid_optional_field" }, { status: 400 });
  }
  if (exercises === null) {
    return NextResponse.json({ error: "invalid_exercises" }, { status: 400 });
  }

  // Replacing the whole exercise list (delete-then-recreate) rather than
  // diffing old vs new rows — an edit form always submits its complete,
  // current set of rows (including ones the user removed), so there's
  // nothing a diff would preserve that this doesn't already recompute
  // correctly, and it avoids reconciling reordered/renamed rows by id.
  await db.$transaction([
    db.exercise.deleteMany({ where: { activityId: params.id } }),
    db.activity.update({
      where: { id: params.id },
      data: {
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
            sets: {
              create: ex.sets.map((s, j) => ({ order: j, reps: s.reps, weightKg: s.weightKg, rpe: s.rpe })),
            },
          })),
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

// Deletes any activity the user owns, regardless of provider — this is a
// local-only removal (Strava sync is gone entirely, see CLAUDE.md, so
// there's no "re-appears on next sync" concern for a STRAVA-provider row
// either). Exercise and ActivityDetail rows cascade via the schema's
// onDelete: Cascade; nothing else references an Activity.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const existing = await db.activity.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.activity.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
