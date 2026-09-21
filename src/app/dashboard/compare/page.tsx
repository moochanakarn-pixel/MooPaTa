import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { CompareView, type CompareActivity } from "./compare-view";

export default async function ComparePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [t, tc] = await Promise.all([getTranslations("compare"), getTranslations("common")]);

  const [user, activities] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activity.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: {
        id: true,
        type: true,
        name: true,
        startedAt: true,
        distanceMeters: true,
        durationSec: true,
        avgSpeedMs: true,
        elevationGainM: true,
        avgHeartRate: true,
        avgCadence: true,
        calories: true,
      },
    }),
  ]);

  const unit = user?.unitSystem ?? "METRIC";
  const rows: CompareActivity[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    startedAtMs: a.startedAt.getTime(),
    distanceMeters: a.distanceMeters,
    durationSec: a.durationSec,
    avgSpeedMs: a.avgSpeedMs,
    elevationGainM: a.elevationGainM,
    avgHeartRate: a.avgHeartRate,
    avgCadence: a.avgCadence,
    calories: a.calories,
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tc("backToOverview")}
      </Link>

      <h1 className="mb-8 text-xl font-bold">{t("title")}</h1>

      <CompareView activities={rows} unit={unit} />
    </main>
  );
}
