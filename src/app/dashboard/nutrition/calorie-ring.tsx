// Circular progress ring for today's calories — same "eaten vs. target"
// data the food page already shows as a bar, in the ring shape competitor
// apps use as their headline visual. Plain SVG, no interactivity needed,
// so this stays a server component (no client JS shipped for it).
const SIZE = 220;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = target > 0 && eaten > target;
  const offset = CIRCUMFERENCE * (1 - pct);
  const remaining = Math.max(target - eaten, 0);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#27272a" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={over ? "#f59e0b" : "#fc4c02"}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tracking-tight tabular-nums">{Math.round(eaten).toLocaleString("th-TH")}</span>
        <span className="text-xs text-neutral-500">จากเป้า {target.toLocaleString("th-TH")} kcal</span>
        <span className={`mt-1 text-xs font-medium ${over ? "text-amber-400" : "text-neutral-400"}`}>
          {over ? `เกินไป ${Math.round(eaten - target).toLocaleString("th-TH")} kcal` : `เหลืออีก ${Math.round(remaining).toLocaleString("th-TH")} kcal`}
        </span>
      </div>
    </div>
  );
}
