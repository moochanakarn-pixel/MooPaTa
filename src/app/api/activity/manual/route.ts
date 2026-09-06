import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const MAX_DURATION_MIN = 24 * 60;
const INTENSITIES = ["LOW", "MODERATE", "HIGH"];
const MAX_EXERCISES = 30;

interface ParsedExercise {
  name: string;
  sets: number;
  reps: number;
  weightKg: number | null;
}

// Validates the optional per-exercise breakdown (sets/reps/weight) a
// strength-training session can be logged with — every row must be
// well-formed or the whole request is rejected, same as the other optional
// fields below, rather than silently dropping a malformed one.
function parseExercises(value: unknown): ParsedExercise[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_EXERCISES) return null;

  const parsed: ParsedExercise[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 100) : "";
    const sets = Number(r.sets);
    const reps = Number(r.reps);
    const weightKg = optionalNonNegative(r.weightKg);
    if (!name) return null;
    if (!Number.isInteger(sets) || sets <= 0 || sets > 50) return null;
    if (!Number.isInteger(reps) || reps <= 0 || reps > 1000) return null;
    if (weightKg !== null && Number.isNaN(weightKg)) return null;
    parsed.push({ name, sets, reps, weightKg });
  }
  return parsed;
}

// Optional fields beyond duration — a phone/watch app that recorded the
// session (e.g. Huawei Health, when its own auto-share to Strava doesn't
// cover a given sport mode) usually shows these, so letting them be copied
// in here makes a manually-logged activity as complete as a synced one.
function optionalNonNegative(value: unknown): number | null {
  const n = Number(value);
  return typeof value === "number" || (typeof value === "string" && value.trim() !== "")
    ? Number.isFinite(n) && n >= 0
      ? n
      : NaN // signal "provided but invalid" distinctly from "not provided"
    : null;
}

// Logs an activity Strava doesn't track (football, badminton, ...) into the
// same Activity table synced activities use — provider=MANUAL with a random
// providerActId satisfies the (provider, providerActId) unique constraint.
// This is what makes it show up for free everywhere Activity already flows:
// the dashboard list, records, heatmap/streaks, compare, and the water/macro
// activity-bonus calculations.
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
  if ([distanceKm, avgHeartRate, maxHeartRate, calories].some((n) => n !== null && Number.isNaN(n))) {
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
      avgHeartRate,
      maxHeartRate,
      calories,
      raw: intensity ? { manualIntensity: intensity } : {},
      exercises: {
        create: exercises.map((ex, i) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weightKg: ex.weightKg,
          order: i,
        })),
      },
    },
  });
  return NextResponse.json({ ok: true, id: activity.id });
}
