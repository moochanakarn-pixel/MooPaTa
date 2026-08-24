import { formatDuration } from "@/lib/format";
import { computeHrZones } from "@/lib/hr-zones";
import type { StreamPoint } from "@/lib/streams";

const ZONE_COLOR = ["#38bdf8", "#10b981", "#f59e0b", "#fb923c", "#ef4444"];
const ZONE_LABEL = ["ฟื้นตัว", "เบา", "ปานกลาง", "หนัก", "สูงสุด"];

// hrMax is the account's highest recorded heart rate across all activities
// (not this one activity), used as a stand-in for a real max-HR test/config
// — the app doesn't ask users for age or a lab-tested max.
export function HrZones({ streams, hrMax }: { streams: StreamPoint[]; hrMax: number | null }) {
  if (!hrMax) return null;
  const zones = computeHrZones(streams, hrMax);
  if (!zones) return null;

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-neutral-300">โซนหัวใจ</h3>
        <span className="text-xs text-neutral-500">อ้างอิงหัวใจสูงสุด {Math.round(hrMax)} bpm</span>
      </div>
      <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
        {zones.map((z) =>
          z.pct > 0 ? <div key={z.zone} style={{ width: `${z.pct}%`, background: ZONE_COLOR[z.zone - 1] }} /> : null
        )}
      </div>
      <div className="space-y-1.5">
        {zones.map(
          (z) =>
            z.seconds > 0 && (
              <div key={z.zone} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-neutral-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: ZONE_COLOR[z.zone - 1] }} />
                  Z{z.zone} {ZONE_LABEL[z.zone - 1]}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-neutral-500">{formatDuration(Math.round(z.seconds))}</span>
                  <span className="w-10 text-right font-medium tabular-nums text-neutral-200">{Math.round(z.pct)}%</span>
                </span>
              </div>
            )
        )}
      </div>
    </div>
  );
}
