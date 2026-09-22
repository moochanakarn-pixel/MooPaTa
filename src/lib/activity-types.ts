// Canonical list of activity types a user can pick when logging manually or
// setting a per-type monthly goal (src/app/dashboard/log-activity/log-activity-form.tsx,
// src/app/dashboard/settings/settings-client.tsx's ActivityGoalsInput) — kept
// as one shared list so the two pickers can never drift apart. Legacy
// Strava-synced activities can carry other type strings (TrailRun,
// VirtualRide, Hike, Soccer, EBikeRide, ...) that aren't in this list; those
// are display-only concerns (activityColor/activityTypeLabel already handle
// them via fallback), not choices a user makes going forward.
export const LOGGABLE_ACTIVITY_TYPES = [
  "Run",
  "Ride",
  "Walk",
  "Swim",
  "WeightTraining",
  "Football",
  "Badminton",
  "Workout",
] as const;

export type LoggableActivityType = (typeof LOGGABLE_ACTIVITY_TYPES)[number];
