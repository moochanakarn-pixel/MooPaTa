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
