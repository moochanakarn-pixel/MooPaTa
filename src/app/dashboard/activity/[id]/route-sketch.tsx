import { decodePolyline } from "@/lib/polyline";

const SIZE = 200;
const PADDING = 14;

// Draws the route as a plain line sketch — no map tiles/API key needed. Not
// a real projection (lat/lng scaled linearly), fine at the scale of a single
// activity where the curvature of the earth doesn't matter.
export function RouteSketch({ polyline }: { polyline: string }) {
  const points = decodePolyline(polyline);
  if (points.length < 2) return null;

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  const scale = Math.min((SIZE - PADDING * 2) / lngRange, (SIZE - PADDING * 2) / latRange);
  const contentW = lngRange * scale;
  const contentH = latRange * scale;
  const offsetX = (SIZE - contentW) / 2;
  const offsetY = (SIZE - contentH) / 2;

  const toXY = ([lat, lng]: [number, number]): [number, number] => [
    offsetX + (lng - minLng) * scale,
    SIZE - offsetY - (lat - minLat) * scale,
  ];

  const d = points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const [startX, startY] = toXY(points[0]);
  const [endX, endY] = toXY(points[points.length - 1]);

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto h-auto max-h-72 w-full">
        <path d={d} fill="none" stroke="#fc4c02" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={startX} cy={startY} r="4.5" fill="#22c55e" stroke="#0a0a0a" strokeWidth="1.5" />
        <circle cx={endX} cy={endY} r="4.5" fill="#ef4444" stroke="#0a0a0a" strokeWidth="1.5" />
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
