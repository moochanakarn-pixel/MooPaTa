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

// Subset of LOGGABLE_ACTIVITY_TYPES that a monthly *distance* goal
// (ActivityGoal.goalKm) actually makes sense for — used to narrow the
// "add a goal" type picker in ActivityGoalsInput and to validate
// POST /api/settings/goal. WeightTraining/Football/Badminton/Workout are
// excluded: they're stationary or GPS-untracked in this app (no distance
// field is ever meaningfully filled in for them — see
// computeAvgSpeedMs's comment), so offering a "กม./เดือน" goal for them
// reads as nonsensical rather than just unused. Found from a user report:
// a monthlyGoalKm→ActivityGoal migration backfill (see CLAUDE.md's
// "เป้าหมายรายเดือนแยกตามประเภทกิจกรรม") guessed a user's most-logged
// type without checking whether that type had a meaningful distance
// concept at all, producing a "เวทเทรนนิ่ง ... กม." goal that made no
// sense — scripts/cleanup-non-distance-activity-goals-2026-09-22.mjs
// removes any such existing rows.
export const DISTANCE_ACTIVITY_TYPES = ["Run", "Ride", "Walk", "Swim"] as const;

export type DistanceActivityType = (typeof DISTANCE_ACTIVITY_TYPES)[number];
