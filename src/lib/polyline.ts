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

export interface RoutePathGeometry {
  d: string;
  start: [number, number];
  end: [number, number];
  size: number;
}

// Projects a decoded route onto a size x size box (linear lat/lng scaling —
// not a real map projection, but fine at single-activity scale). Shared by
// the on-page route sketch and the share-card image generator so both draw
// the exact same line.
export function buildRoutePath(polyline: string, size = 200, padding = 14): RoutePathGeometry | null {
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

  return { d, start: toXY(points[0]), end: toXY(points[points.length - 1]), size };
}

// Renders route geometry as a standalone SVG data URI, for contexts (like
// the share-card <img>) that can't render an inline <path> directly.
export function routeGeometryToSvgDataUri(geo: RoutePathGeometry, strokeColor = "#fc4c02"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.size} ${geo.size}"><path d="${geo.d}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${geo.start[0]}" cy="${geo.start[1]}" r="5" fill="#22c55e"/><circle cx="${geo.end[0]}" cy="${geo.end[1]}" r="5" fill="#ef4444"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
