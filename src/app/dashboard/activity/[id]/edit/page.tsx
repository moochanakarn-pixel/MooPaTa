import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getExerciseStats, getLastWorkoutSession } from "@/lib/exercise-stats";
import { getSessionUserId } from "@/lib/session";
import { LogActivityForm, type LogActivityInitial } from "../../../log-activity/log-activity-form";

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Editing is only ever offered for provider: "MANUAL" activities — see
// PATCH /api/activity/[id]'s comment for why a Strava-synced one stays
// read-only/delete-only instead. A direct link here for one of those (or
// for someone else's activity) 404s rather than silently redirecting, same
// as the detail page already does for an id that isn't the viewer's own.
export default async function EditActivityPage({ params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [activity, exerciseStats, lastWorkoutSession, user] = await Promise.all([
    db.activity.findUnique({
      where: { id: params.id },
      include: { exercises: { orderBy: { order: "asc" }, include: { sets: { orderBy: { order: "asc" } } } } },
    }),
    getExerciseStats(userId, params.id),
    getLastWorkoutSession(userId, params.id),
    db.user.findUnique({ where: { id: userId }, select: { weightKg: true } }),
  ]);
  if (!activity || activity.userId !== userId || activity.provider !== "MANUAL") notFound();

  const raw = activity.raw as { manualIntensity?: string } | null;

  const initial: LogActivityInitial = {
    type: activity.type,
    name: activity.name ?? "",
    durationMin: String(Math.round(activity.durationSec / 60)),
    intensity: raw?.manualIntensity ?? "MODERATE",
    startedAt: toDatetimeLocal(activity.startedAt),
    distanceKm: activity.distanceMeters !== null ? String(activity.distanceMeters / 1000) : "",
    avgHeartRate: activity.avgHeartRate !== null ? String(Math.round(activity.avgHeartRate)) : "",
    maxHeartRate: activity.maxHeartRate !== null ? String(Math.round(activity.maxHeartRate)) : "",
    calories: activity.calories !== null ? String(Math.round(activity.calories)) : "",
    avgCadence: activity.avgCadence !== null ? String(Math.round(activity.avgCadence)) : "",
    rpe: activity.rpe !== null ? String(activity.rpe) : "",
    notes: activity.notes ?? "",
    exercises: activity.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets.map((s) => ({
        reps: String(s.reps),
        weightKg: s.weightKg !== null ? String(s.weightKg) : "",
        rpe: s.rpe !== null ? String(s.rpe) : "",
      })),
    })),
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href={`/dashboard/activity/${activity.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปหน้ากิจกรรม
      </Link>

      <h1 className="mb-1 text-xl font-bold">แก้ไขกิจกรรม</h1>
      <p className="mb-8 text-sm text-neutral-500">แก้ไขข้อมูลกิจกรรมนี้ รวมถึงท่าออกกำลังกายแต่ละท่าได้</p>

      <LogActivityForm
        activityId={activity.id}
        initial={initial}
        exerciseStats={exerciseStats}
        lastWorkoutSession={lastWorkoutSession}
        userWeightKg={user?.weightKg ?? null}
      />
    </main>
  );
}
