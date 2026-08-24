// Decodes Google's encoded polyline format (used by Strava's summary_polyline).
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

// Pulls the encoded route (if any) out of a stored Strava raw activity payload.
export function extractStravaPolyline(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object" || !("map" in raw)) return undefined;
  const map = (raw as { map?: unknown }).map;
  if (!map || typeof map !== "object" || !("summary_polyline" in map)) return undefined;
  const polyline = (map as { summary_polyline?: unknown }).summary_polyline;
  return typeof polyline === "string" && polyline.length > 0 ? polyline : undefined;
}

export interface RouteMarker {
  x: number;
  y: number;
  label: string;
}

export interface RouteArrow {
  x: number;
  y: number;
  angleDeg: number;
}

export interface RoutePathGeometry {
  d: string;
  start: [number, number];
  end: [number, number];
  size: number;
  markers: RouteMarker[];
  arrow: RouteArrow | null;
}

// Great-circle distance between two lat/lng points, in meters. Used to place
// km/mile markers along the route by real-world distance — the projected
// x/y coordinates below are locally scaled for drawing, not proportional to
// actual ground distance.
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Projects a decoded route onto a size x size box (linear lat/lng scaling —
// not a real map projection, but fine at single-activity scale). Shared by
// the on-page route sketch and the share-card image generator so both draw
// the exact same line. Also places distance markers (every km, or mile for
// imperial users) and a direction-of-travel arrow at the route's midpoint.
export function buildRoutePath(
  polyline: string,
  size = 200,
  padding = 14,
  unit: "METRIC" | "IMPERIAL" = "METRIC"
): RoutePathGeometry | null {
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

  const scale = Math.min((size - padding * 2) / lngRange, (size - padding * 2) / latRange);
  const contentW = lngRange * scale;
  const contentH = latRange * scale;
  const offsetX = (size - contentW) / 2;
  const offsetY = (size - contentH) / 2;

  const toXY = ([lat, lng]: [number, number]): [number, number] => [
    offsetX + (lng - minLng) * scale,
    size - offsetY - (lat - minLat) * scale,
  ];

  const d = points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Cumulative real-world distance at each point, for placing markers and
  // the direction arrow by actual ground distance rather than point index
  // (points aren't evenly spaced — Strava emits more of them on turns).
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMeters(points[i - 1], points[i]));
  }
  const totalDistance = cumulative[cumulative.length - 1];

  // Interpolates a projected x/y at a target cumulative distance along the route.
  function pointAtDistance(target: number): [number, number] {
    let i = 1;
    while (i < cumulative.length && cumulative[i] < target) i++;
    i = Math.min(i, cumulative.length - 1);
    const segStart = cumulative[i - 1];
    const segEnd = cumulative[i];
    const frac = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
    const [x1, y1] = toXY(points[i - 1]);
    const [x2, y2] = toXY(points[i]);
    return [x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac];
  }

  const stepMeters = unit === "IMPERIAL" ? 1609.344 : 1000;
  const markers: RouteMarker[] = [];
  // Skip a marker too close to the end dot (within a quarter step) so it
  // doesn't visually collide with the finish marker.
  for (let k = stepMeters, n = 1; k < totalDistance - stepMeters * 0.25; k += stepMeters, n++) {
    const [x, y] = pointAtDistance(k);
    markers.push({ x, y, label: String(n) });
  }

  let arrow: RouteArrow | null = null;
  if (totalDistance > 50) {
    const mid = totalDistance / 2;
    const [mx, my] = pointAtDistance(mid);
    const [bx, by] = pointAtDistance(Math.max(0, mid - stepMeters * 0.1));
    const [ax, ay] = pointAtDistance(Math.min(totalDistance, mid + stepMeters * 0.1));
    const angleDeg = (Math.atan2(ay - by, ax - bx) * 180) / Math.PI;
    arrow = { x: mx, y: my, angleDeg };
  }

  return { d, start: toXY(points[0]), end: toXY(points[points.length - 1]), size, markers, arrow };
}

// Renders route geometry as a standalone SVG data URI, for contexts (like
// the share-card <img>) that can't render an inline <path> directly. This
// goes through resvg (via next/og), which — unlike a browser — silently
// drops <text> elements in a data-URI SVG with no embedded font, so the km
// markers render as plain dots here instead of the numbered dots the
// on-page inline SVG (RouteSketch) draws.
export function routeGeometryToSvgDataUri(geo: RoutePathGeometry, strokeColor = "#fc4c02"): string {
  const markers = geo.markers
    .map((m) => `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="3.5" fill="#0a0a0a" stroke="${strokeColor}" stroke-width="1.5"/>`)
    .join("");
  const arrow = geo.arrow
    ? `<path d="M-4,-3.5 L4,0 L-4,3.5 Z" fill="${strokeColor}" transform="translate(${geo.arrow.x.toFixed(1)},${geo.arrow.y.toFixed(1)}) rotate(${geo.arrow.angleDeg.toFixed(1)})"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.size} ${geo.size}"><path d="${geo.d}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${arrow}${markers}<circle cx="${geo.start[0]}" cy="${geo.start[1]}" r="5" fill="#22c55e"/><circle cx="${geo.end[0]}" cy="${geo.end[1]}" r="5" fill="#ef4444"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
