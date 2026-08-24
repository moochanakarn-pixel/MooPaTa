// Per-activity-type accent, used everywhere an activity's icon/badge shows
// up (dashboard list, records, activity detail header). Previously every
// type rendered in the same Strava orange — this gives Ride/Swim/Walk/etc.
// their own identity so a list of mixed activities reads as more than one
// long flat column. Tailwind's JIT scanner needs literal class strings (no
// dynamic template interpolation), hence the explicit map instead of
// building class names from a base color at runtime.
export interface ActivityColor {
  bg: string;
  text: string;
  ring: string;
  from: string;
  to: string;
  solid: string;
}

const RUN: ActivityColor = {
  bg: "bg-[#fc4c02]/10",
  text: "text-[#fc4c02]",
  ring: "ring-[#fc4c02]/25",
  from: "from-[#fc4c02]",
  to: "to-[#ff8a3d]",
  solid: "bg-[#fc4c02]",
};

const RIDE: ActivityColor = {
  bg: "bg-sky-500/10",
  text: "text-sky-400",
  ring: "ring-sky-500/25",
  from: "from-sky-500",
  to: "to-sky-300",
  solid: "bg-sky-500",
};

const WALK: ActivityColor = {
  bg: "bg-emerald-500/10",
  text: "text-emerald-400",
  ring: "ring-emerald-500/25",
  from: "from-emerald-500",
  to: "to-emerald-300",
  solid: "bg-emerald-500",
};

const SWIM: ActivityColor = {
  bg: "bg-cyan-500/10",
  text: "text-cyan-400",
  ring: "ring-cyan-500/25",
  from: "from-cyan-500",
  to: "to-cyan-300",
  solid: "bg-cyan-500",
};

const LIFT: ActivityColor = {
  bg: "bg-violet-500/10",
  text: "text-violet-400",
  ring: "ring-violet-500/25",
  from: "from-violet-500",
  to: "to-violet-300",
  solid: "bg-violet-500",
};

const OTHER: ActivityColor = {
  bg: "bg-rose-500/10",
  text: "text-rose-400",
  ring: "ring-rose-500/25",
  from: "from-rose-500",
  to: "to-rose-300",
  solid: "bg-rose-500",
};

const BY_TYPE: Record<string, ActivityColor> = {
  Run: RUN,
  TrailRun: RUN,
  Ride: RIDE,
  VirtualRide: RIDE,
  EBikeRide: RIDE,
  Walk: WALK,
  Hike: WALK,
  Swim: SWIM,
  WeightTraining: LIFT,
  Workout: LIFT,
};

export function activityColor(type: string): ActivityColor {
  return BY_TYPE[type] ?? OTHER;
}
