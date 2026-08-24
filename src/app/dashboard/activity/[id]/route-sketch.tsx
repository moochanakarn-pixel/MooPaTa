import { buildRoutePath } from "@/lib/polyline";
import type { UnitSystem } from "@/lib/format";

// Draws the route as a plain line sketch — no map tiles/API key needed.
// Markers along the line mark each completed km (or mile), and the small
// triangle at the midpoint shows which direction the route was run in —
// both come free from buildRoutePath's real-world distance calculation.
export function RouteSketch({ polyline, unit = "METRIC" }: { polyline: string; unit?: UnitSystem }) {
  const geo = buildRoutePath(polyline, 200, 14, unit);
  if (!geo) return null;

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <svg viewBox={`0 0 ${geo.size} ${geo.size}`} className="mx-auto h-auto max-h-72 w-full">
        <path d={geo.d} fill="none" stroke="#fc4c02" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {geo.arrow && (
          <path
            d="M-4,-3.5 L4,0 L-4,3.5 Z"
            fill="#fc4c02"
            transform={`translate(${geo.arrow.x},${geo.arrow.y}) rotate(${geo.arrow.angleDeg})`}
          />
        )}
        {geo.markers.map((m) => (
          <g key={m.label}>
            <circle cx={m.x} cy={m.y} r="4" fill="#0a0a0a" stroke="#fc4c02" strokeWidth="1.5" />
            <text x={m.x} y={m.y + 2.5} fontSize="5.5" fontWeight="700" fill="#fc4c02" textAnchor="middle">
              {m.label}
            </text>
          </g>
        ))}
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
        {geo.markers.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full border border-[#fc4c02] text-[6px] font-bold text-[#fc4c02]">
              #
            </span>
            {unit === "IMPERIAL" ? "ไมล์ที่ผ่าน" : "กม.ที่ผ่าน"}
          </span>
        )}
      </div>
    </div>
  );
}
