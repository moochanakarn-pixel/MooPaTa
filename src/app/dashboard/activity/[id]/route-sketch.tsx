import { buildRoutePath } from "@/lib/polyline";

// Draws the route as a plain line sketch — no map tiles/API key needed.
export function RouteSketch({ polyline }: { polyline: string }) {
  const geo = buildRoutePath(polyline);
  if (!geo) return null;

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <svg viewBox={`0 0 ${geo.size} ${geo.size}`} className="mx-auto h-auto max-h-72 w-full">
        <path d={geo.d} fill="none" stroke="#fc4c02" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={geo.start[0]} cy={geo.start[1]} r="4.5" fill="#22c55e" stroke="#0a0a0a" strokeWidth="1.5" />
        <circle cx={geo.end[0]} cy={geo.end[1]} r="4.5" fill="#ef4444" stroke="#0a0a0a" strokeWidth="1.5" />
      </svg>
      <div className="mt-2 flex justify-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> เริ่มต้น
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> สิ้นสุด
        </span>
      </div>
    </div>
  );
}
