const WEEKDAY_LABEL = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export interface StreakWeekDay {
  dayOfMonth: number;
  isToday: boolean;
  logged: boolean;
}

export function LoggingStreakCard({
  currentStreak,
  longestFoodStreak,
  longestWeightStreak,
  weekDays,
}: {
  currentStreak: number;
  longestFoodStreak: number;
  longestWeightStreak: number;
  weekDays: StreakWeekDay[];
}) {
  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-3 font-medium">สถิติบันทึกต่อเนื่อง</h2>

      <p className="mb-4 flex items-baseline gap-2 text-2xl font-extrabold">
        <span>🔥</span>
        {currentStreak} <span className="text-sm font-normal text-neutral-500">วัน</span>
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="font-semibold text-neutral-200">{longestFoodStreak} วัน</p>
          <p className="text-xs text-neutral-500">บันทึกอาหารต่อเนื่องสูงสุด</p>
        </div>
        <div>
          <p className="font-semibold text-neutral-200">{longestWeightStreak} วัน</p>
          <p className="text-xs text-neutral-500">บันทึกน้ำหนักต่อเนื่องสูงสุด</p>
        </div>
      </div>

      <div className="flex justify-between border-t border-neutral-800 pt-4">
        {weekDays.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={`text-[10px] ${d.isToday ? "text-lime-400" : "text-neutral-600"}`}>{WEEKDAY_LABEL[i]}</span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                d.logged
                  ? "bg-lime-500/20 text-lime-400"
                  : d.isToday
                    ? "border border-lime-500/50 text-lime-400"
                    : "text-neutral-500"
              }`}
            >
              {d.dayOfMonth}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
