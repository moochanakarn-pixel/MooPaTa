import Link from "next/link";

export interface HealthSummaryProps {
  hasAnyData: boolean;
  targets: { targetCalories: number; proteinG: number; carbG: number; fatG: number } | null;
  todayCalories: number;
  todayProteinG: number;
  todayCarbG: number;
  todayFatG: number;
  waterMl: number;
  waterTargetMl: number | null;
  latestWeightKg: number | null;
  weightDeltaKg: number | null; // vs the previous logged reading; null with fewer than 2 logs
  supplementsTakenToday: number;
  supplementsTotal: number;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// Surfaces everything the user has been manually entering (nutrition
// profile, food/water logs, weight, supplements) on the homepage — those
// features previously only showed up if you navigated into their own
// sub-pages, so anyone who'd filled them in had no glanceable "today"
// summary next to the Strava stats.
export function HealthSummary(props: HealthSummaryProps) {
  if (!props.hasAnyData) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-dashed border-neutral-800 px-5 py-4">
        <p className="text-sm text-neutral-500">ยังไม่มีข้อมูลโภชนาการ — เริ่มบันทึกอาหาร น้ำ หรือน้ำหนักได้ที่หน้าโภชนาการ</p>
        <Link href="/dashboard/nutrition" className="flex-none text-sm font-medium text-lime-400 hover:underline">
          เริ่มเลย
        </Link>
      </div>
    );
  }

  const { targets, todayCalories, todayProteinG, todayCarbG, todayFatG, waterMl, waterTargetMl } = props;
  const { latestWeightKg, weightDeltaKg, supplementsTakenToday, supplementsTotal } = props;

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-medium">สุขภาพวันนี้</h2>
        <Link href="/dashboard/nutrition" className="text-xs text-neutral-500 transition hover:text-neutral-300">
          ดูทั้งหมด
        </Link>
      </div>

      {targets ? (
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-xs text-neutral-500">แคลอรี่</p>
            <p className="text-sm tabular-nums text-neutral-400">
              <span className="font-semibold text-neutral-100">{Math.round(todayCalories).toLocaleString("th-TH")}</span> /{" "}
              {targets.targetCalories.toLocaleString("th-TH")} kcal
            </p>
          </div>
          <ProgressBar value={todayCalories} max={targets.targetCalories} color={todayCalories > targets.targetCalories ? "#f59e0b" : "#a3e635"} />
          <div className="mt-2 flex gap-4 text-[11px] text-neutral-600">
            <span>
              โปรตีน <span className="text-neutral-400">{Math.round(todayProteinG)}</span>/{targets.proteinG} ก.
            </span>
            <span>
              คาร์บ <span className="text-neutral-400">{Math.round(todayCarbG)}</span>/{targets.carbG} ก.
            </span>
            <span>
              ไขมัน <span className="text-neutral-400">{Math.round(todayFatG)}</span>/{targets.fatG} ก.
            </span>
          </div>
        </div>
      ) : (
        <Link
          href="/dashboard/settings"
          className="mb-4 block rounded-lg border border-dashed border-neutral-800 px-3 py-2 text-xs text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
        >
          ยังไม่ได้ตั้งเป้าหมายแคลอรี่ — กรอกโปรไฟล์โภชนาการ
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="mb-1 text-xs text-neutral-500">น้ำดื่ม</p>
          <p className="text-sm font-semibold tabular-nums">
            {(waterMl / 1000).toFixed(1)}
            {waterTargetMl && <span className="font-normal text-neutral-500"> / {(waterTargetMl / 1000).toFixed(1)}</span>} ล.
          </p>
          {waterTargetMl && <div className="mt-1.5"><ProgressBar value={waterMl} max={waterTargetMl} color="#22d3ee" /></div>}
        </div>

        <div>
          <p className="mb-1 text-xs text-neutral-500">น้ำหนักล่าสุด</p>
          {latestWeightKg !== null ? (
            <p className="text-sm font-semibold tabular-nums">
              {latestWeightKg.toFixed(1)} กก.
              {weightDeltaKg !== null && weightDeltaKg !== 0 && (
                <span className={`ml-1 text-xs font-normal ${weightDeltaKg < 0 ? "text-lime-400" : "text-amber-400"}`}>
                  {weightDeltaKg > 0 ? "+" : ""}
                  {weightDeltaKg.toFixed(1)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-neutral-600">ยังไม่มีบันทึก</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs text-neutral-500">อาหารเสริม</p>
          {supplementsTotal > 0 ? (
            <p className="text-sm font-semibold tabular-nums">
              {supplementsTakenToday}/{supplementsTotal} <span className="font-normal text-neutral-500">ครั้ง</span>
            </p>
          ) : (
            <p className="text-xs text-neutral-600">ยังไม่มีรายการ</p>
          )}
        </div>
      </div>
    </div>
  );
}
