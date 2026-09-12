// Shape of the historical per-activity detail data cached in
// ActivityDetail.splits/bestEfforts/laps back when activities synced from
// Strava (see CLAUDE.md — Strava sync was removed; this file only describes
// the already-stored JSON so old activity detail pages keep rendering).
export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
}

export interface StravaBestEffort {
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  pr_rank: number | null; // 1 = current all-time PR for this effort
}

export interface StravaLap {
  lap_index: number;
  distance: number;
  moving_time: number;
  average_speed: number;
  total_elevation_gain: number;
  average_heartrate?: number;
}
