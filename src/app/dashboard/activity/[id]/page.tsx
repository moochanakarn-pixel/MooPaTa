import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { activityColor } from "@/lib/activity-colors";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  activitySpeedValue,
  activityTypeLabel,
  formatActivityDate,
  formatDistanceKm,
  formatDuration,
  formatElevationM,
} from "@/lib/format";
import { extractStravaPolyline } from "@/lib/polyline";
import type { StravaBestEffort, StravaLap, StravaSplit } from "@/lib/activity-detail-types";
import type { StreamPoint } from "@/lib/streams";
import type { ActivityWeather } from "@/lib/weather";
import { ActivityIcon } from "../../activity-icon";
import { ComparisonCard, PersonalRecordBadges } from "./comparison";
import { DeleteActivityButton } from "./delete-activity-button";
import { DetailPanel } from "./detail-panel";
import { RouteSketch } from "./route-sketch";
import { ShareActivityButton } from "./share-activity-button";

function Stat({ label, value }: { label: string; value: string }) {
  if (value === "-") return null;
  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <p className="text-lg font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

export default async function ActivityDetailPage({ params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [user, activity] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activity.findUnique({
      where: { id: params.id },
      include: { exercises: { orderBy: { order: "asc" }, include: { sets: { orderBy: { order: "asc" } } } } },
    }),
  ]);
  if (!activity || activity.userId !== userId) notFound();

  const unit = user?.unitSystem ?? "METRIC";
  const isRun = activity.type === "Run";
  // Run and Swim both read their speed as a "pace" (min:sec per km, or per
  // 100m for swimming) rather than km/h — everything else (cycling etc.)
  // uses plain speed. isRun above stays scoped to DetailPanel's legacy
  // Strava splits/laps view, which only ever handled the running case.
  const usesPace = activity.type === "Run" || activity.type === "Swim";
  const polyline = extractStravaPolyline(activity.raw);
  const color = activityColor(activity.type);

  const [previous, bests, detail, hrAgg] = await Promise.all([
    db.activity.findFirst({
      where: { userId, type: activity.type, startedAt: { lt: activity.startedAt } },
      orderBy: { startedAt: "desc" },
    }),
    db.activity.aggregate({
      where: { userId, type: activity.type },
      _max: { distanceMeters: true, avgSpeedMs: true },
    }),
    db.activityDetail.findUnique({ where: { activityId: activity.id } }),
    db.activity.aggregate({
      where: { userId },
      _max: { maxHeartRate: true },
    }),
  ]);

  const badges: string[] = [];
  if (activity.distanceMeters && activity.distanceMeters === bests._max.distanceMeters) {
    badges.push(`ระยะทางไกลที่สุด (${activityTypeLabel(activity.type)})`);
  }
  if (activity.avgSpeedMs && activity.avgSpeedMs === bests._max.avgSpeedMs) {
    const label = activity.type === "Run" || activity.type === "Swim" ? "เพซเร็วที่สุด" : "ความเร็วสูงสุด";
    badges.push(`${label} (${activityTypeLabel(activity.type)})`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          กลับไปหน้ารวม
        </Link>
        <div className="flex items-center gap-2">
          {activity.provider === "MANUAL" && (
            <Link
              href={`/dashboard/activity/${activity.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path
                  d="M13.5 3.5 16 6l-9 9-3 1 1-3 9-9Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              แก้ไข
            </Link>
          )}
          <DeleteActivityButton activityId={activity.id} />
          <ShareActivityButton activityId={activity.id} />
        </div>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br ${color.from} ${color.to} text-white shadow-lg shadow-black/20`}>
          <ActivityIcon type={activity.type} className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">{activity.name ?? activity.type}</h1>
          <p className="text-sm text-neutral-500">
            {activityTypeLabel(activity.type)} · {formatActivityDate(activity.startedAt)}
          </p>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="mb-6">
          <PersonalRecordBadges badges={badges} />
        </div>
      )}

      {polyline && (
        <div className="mb-6">
          <RouteSketch polyline={polyline} unit={unit} />
        </div>
      )}

      {previous && (
        <div className="mb-6">
          <ComparisonCard
            title={`เทียบกับครั้งก่อน (${activityTypeLabel(activity.type)} · ${formatActivityDate(previous.startedAt)})`}
            current={activity}
            compare={previous}
            unit={unit}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="ระยะทาง" value={formatDistanceKm(activity.distanceMeters, unit)} />
        <Stat label="เวลา" value={formatDuration(activity.durationSec)} />
        <Stat
          label={usesPace ? "เพซเฉลี่ย" : "ความเร็วเฉลี่ย"}
          value={activitySpeedValue(activity.type, activity.avgSpeedMs, unit)}
        />
        <Stat
          label={usesPace ? "เพซสูงสุด" : "ความเร็วสูงสุด"}
          value={activitySpeedValue(activity.type, activity.maxSpeedMs, unit)}
        />
        <Stat label="ระยะไต่ระดับ" value={formatElevationM(activity.elevationGainM, unit)} />
        <Stat label="จุดสูงสุด" value={formatElevationM(activity.elevHighM, unit)} />
        <Stat label="จุดต่ำสุด" value={formatElevationM(activity.elevLowM, unit)} />
        <Stat
          label="หัวใจเฉลี่ย"
          value={activity.avgHeartRate ? `${Math.round(activity.avgHeartRate)} bpm` : "-"}
        />
        <Stat
          label="หัวใจสูงสุด"
          value={activity.maxHeartRate ? `${Math.round(activity.maxHeartRate)} bpm` : "-"}
        />
        <Stat label="แคลอรี่" value={activity.calories ? `${Math.round(activity.calories)} kcal` : "-"} />
        <Stat label="ระดับความเหนื่อย (RPE)" value={activity.rpe !== null ? `${activity.rpe}/10` : "-"} />
        <Stat label="เคเดนซ์เฉลี่ย" value={activity.avgCadence ? `${Math.round(activity.avgCadence)} rpm` : "-"} />
        <Stat label="กำลังเฉลี่ย" value={activity.avgWatts ? `${Math.round(activity.avgWatts)} W` : "-"} />
        <Stat label="พลังงาน" value={activity.kilojoules ? `${Math.round(activity.kilojoules)} kJ` : "-"} />
        <Stat label="Suffer Score" value={activity.sufferScore ? String(activity.sufferScore) : "-"} />
        <Stat label="Kudos" value={activity.kudosCount ? String(activity.kudosCount) : "-"} />
        <Stat
          label="สถิติที่ทำได้"
          value={activity.achievementCount ? String(activity.achievementCount) : "-"}
        />
        <Stat label="PR" value={activity.prCount ? String(activity.prCount) : "-"} />
        <Stat label="คอมเมนต์" value={activity.commentCount ? String(activity.commentCount) : "-"} />
        <Stat label="โซนเวลา" value={activity.timezone ?? "-"} />
        <Stat label="อุปกรณ์ (Gear ID)" value={activity.gearId ?? "-"} />
        <Stat
          label="พิกัดเริ่มต้น"
          value={
            activity.startLat && activity.startLng
              ? `${activity.startLat.toFixed(4)}, ${activity.startLng.toFixed(4)}`
              : "-"
          }
        />
      </div>

      {activity.exercises.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 font-medium">ท่าออกกำลังกาย</h2>
          {/* One card per exercise (rather than the old fixed sets/reps/
              weight table columns) since each set can now carry its own
              reps/weight — a pyramid/drop set has a different number for
              every row, not one uniform value to put in a single column. */}
          <div className="space-y-3">
            {activity.exercises.map((ex) => (
              <div key={ex.id} className="rounded-xl border border-neutral-800/80 p-4">
                <p className="mb-2 font-medium">{ex.name}</p>
                <div className="space-y-1">
                  {ex.sets.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">เซ็ท {i + 1}</span>
                      <span className="tabular-nums text-neutral-300">
                        {s.reps} ครั้ง{s.weightKg !== null ? ` × ${s.weightKg} กก.` : ""}
                        {s.rpe !== null ? ` (RPE ${s.rpe})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && (
        <div className="mt-8">
          <h2 className="mb-4 font-medium">รายละเอียดเพิ่มเติม</h2>
          <DetailPanel
            streams={(detail.streams as unknown as StreamPoint[]) ?? []}
            splits={(detail.splits as unknown as StravaSplit[]) ?? []}
            bestEfforts={(detail.bestEfforts as unknown as StravaBestEffort[]) ?? []}
            laps={(detail.laps as unknown as StravaLap[]) ?? []}
            weather={(detail.weather as unknown as ActivityWeather) ?? null}
            deviceName={detail.deviceName}
            unit={unit}
            isRun={isRun}
            hrMax={hrAgg._max.maxHeartRate}
          />
        </div>
      )}

      {activity.provider === "STRAVA" && (
        <details className="mt-8 rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
          <summary className="cursor-pointer text-sm font-medium text-neutral-400">
            ข้อมูลดิบทั้งหมดจาก Strava
          </summary>
          <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-xs text-neutral-400">
            {JSON.stringify(activity.raw, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
