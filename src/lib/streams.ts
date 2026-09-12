export interface StreamPoint {
  distance: number; // meters
  altitude?: number;
  velocity?: number; // m/s
  heartrate?: number;
  cadence?: number;
  time?: number; // elapsed seconds from activity start
}
