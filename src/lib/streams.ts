import type { StravaStreams } from "@/lib/providers/strava";

export interface StreamPoint {
  distance: number; // meters
  altitude?: number;
  velocity?: number; // m/s
  heartrate?: number;
  cadence?: number;
  time?: number; // elapsed seconds from activity start
}

// Strava streams are recorded ~once/second, so a long activity can be
// thousands of points — way more resolution than a chart needs and more
// than worth storing raw. Stride-sample down to a fixed point budget,
// aligned by index since all stream arrays share the same recording points.
export function downsampleStreams(streams: StravaStreams, targetPoints = 120): StreamPoint[] {
  const n = streams.distance.length;
  if (n === 0) return [];

  const stride = Math.max(1, Math.ceil(n / targetPoints));
  const points: StreamPoint[] = [];

  for (let i = 0; i < n; i += stride) {
    points.push({
      distance: streams.distance[i],
      altitude: streams.altitude[i],
      velocity: streams.velocity[i],
      heartrate: streams.heartrate[i],
      cadence: streams.cadence[i],
      time: streams.time[i],
    });
  }

  const last = n - 1;
  if (last % stride !== 0) {
    points.push({
      distance: streams.distance[last],
      altitude: streams.altitude[last],
      velocity: streams.velocity[last],
      heartrate: streams.heartrate[last],
      cadence: streams.cadence[last],
      time: streams.time[last],
    });
  }

  return points;
}
