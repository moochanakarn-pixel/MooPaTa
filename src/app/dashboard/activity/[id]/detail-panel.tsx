import { formatDistanceKm, formatDuration, formatElevationM, formatPace, formatSpeedKmh, type UnitSystem } from "@/lib/format";
import type { StravaBestEffort, StravaLap, StravaSplit } from "@/lib/providers/strava";
import type { StreamPoint } from "@/lib/streams";
import { ProfileChart } from "./profile-chart";

export function DetailPanel({
  streams,
  splits,
  bestEfforts,
  laps,
  deviceName,
  unit,
  isRun,
}: {
  streams: StreamPoint[];
  splits: StravaSplit[];
  bestEfforts: StravaBestEffort[];
  laps: StravaLap[];
  deviceName?: string | null;
  unit: UnitSystem;
  isRun: boolean;
}) {
  const distDivisor = unit === "IMPERIAL" ? 1609.344 : 1000;
  const distUnitLabel = unit === "IMPERIAL" ? "ไมล์" : "กม.";

  const elevationPoints = streams
    .filter((p) => p.altitude !== undefined)
    .map((p) => ({ x: p.distance / distDivisor, y: p.altitude! }));

  const pacePoints = streams
    .filter((p) => p.velocity !== undefined && p.velocity > 0)
    .map((p) => ({ x: p.distance / distDivisor, y: p.velocity! }));

  const heartratePoints = streams
    .filter((p) => p.heartrate !== undefined && p.heartrate > 0)
    .map((p) => ({ x: p.distance / distDivisor, y: p.heartrate! }));

  const cadencePoints = streams
    .filter((p) => p.cadence !== undefined && p.cadence > 0)
    .map((p) => ({ x: p.distance / distDivisor, y: p.cadence! }));

  const prEfforts = bestEfforts.filter((e) => e.pr_rank === 1);

  return (
    <div className="space-y-4">
      {elevationPoints.length > 1 && (
        <ProfileChart
          points={elevationPoints}
          label="ระดับความสูงตลอดระยะทาง"
          color="#38bdf8"
          formatX={(x) => `${x.toFixed(1)} ${distUnitLabel}`}
          formatY={(y) => formatElevationM(y, unit)}
        />
      )}

      {pacePoints.length > 1 && (
        <ProfileChart
          points={pacePoints}
          label={isRun ? "เพซตลอดระยะทาง" : "ความเร็วตลอดระยะทาง"}
          color="#fc4c02"
          formatX={(x) => `${x.toFixed(1)} ${distUnitLabel}`}
          formatY={(y) => (isRun ? formatPace(y, unit) : formatSpeedKmh(y, unit))}
        />
      )}

      {heartratePoints.length > 1 && (
        <ProfileChart
          points={heartratePoints}
          label="อัตราการเต้นหัวใจตลอดระยะทาง"
          color="#f43f5e"
          formatX={(x) => `${x.toFixed(1)} ${distUnitLabel}`}
          formatY={(y) => `${Math.round(y)} bpm`}
        />
      )}

      {cadencePoints.length > 1 && (
        <ProfileChart
          points={cadencePoints}
          label="เคเดนซ์ตลอดระยะทาง"
          color="#a855f7"
          formatX={(x) => `${x.toFixed(1)} ${distUnitLabel}`}
          formatY={(y) => `${Math.round(y)} rpm`}
        />
      )}

      {splits.length > 0 && (
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">Splits ต่อ{unit === "IMPERIAL" ? "ไมล์" : "กิโล"}</h3>
          <div className="divide-y divide-neutral-800/60">
            {splits.map((s) => (
              <div key={s.split} className="flex items-center justify-between py-2 text-sm">
                <span className="text-neutral-500">{distUnitLabel} {s.split}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-neutral-200">{formatPace(s.average_speed, unit)}</span>
                  <span className="text-xs text-neutral-500">
                    {s.elevation_difference > 0 ? "+" : ""}
                    {Math.round(s.elevation_difference)} ม.
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {laps.length > 1 && (
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">Laps</h3>
          <div className="divide-y divide-neutral-800/60">
            {laps.map((lap) => (
              <div key={lap.lap_index} className="flex items-center justify-between py-2 text-sm">
                <span className="text-neutral-500">#{lap.lap_index}</span>
                <span className="text-neutral-400">{formatDistanceKm(lap.distance, unit)}</span>
                <span className="text-neutral-400">{formatDuration(lap.moving_time)}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-neutral-200">{formatPace(lap.average_speed, unit)}</span>
                  <span className="text-xs text-neutral-500">
                    {lap.total_elevation_gain > 0 ? "+" : ""}
                    {Math.round(lap.total_elevation_gain)} ม.
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {prEfforts.length > 0 && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/10 p-4">
          <h3 className="mb-3 text-sm font-medium text-amber-300">สถิติที่ดีที่สุดตลอดกาล (จาก Strava)</h3>
          <div className="divide-y divide-amber-900/30">
            {prEfforts.map((e) => (
              <div key={e.name} className="flex items-center justify-between py-2 text-sm">
                <span className="text-neutral-300">🏆 {e.name}</span>
                <span className="font-medium text-neutral-100">{formatDuration(e.elapsed_time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {deviceName && <p className="text-center text-xs text-neutral-600">บันทึกด้วย {deviceName}</p>}
    </div>
  );
}
