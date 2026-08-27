export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} นาที`;
}

export type UnitSystem = "METRIC" | "IMPERIAL";
const METERS_PER_MILE = 1609.344;

export function formatDistanceKm(meters?: number | null, unit: UnitSystem = "METRIC"): string {
  if (meters === null || meters === undefined) return "-";
  if (unit === "IMPERIAL") return `${(meters / METERS_PER_MILE).toFixed(2)} ไมล์`;
  return `${(meters / 1000).toFixed(2)} กม.`;
}

// Split value/unit, for hero-sized stat displays that render the number and
// unit at different font sizes (e.g. the share card).
export function formatDistanceParts(meters: number | null, unit: UnitSystem = "METRIC"): { value: string; unitLabel: string } {
  const value = unit === "IMPERIAL" ? (meters ?? 0) / METERS_PER_MILE : (meters ?? 0) / 1000;
  return { value: value.toFixed(2), unitLabel: unit === "IMPERIAL" ? "ไมล์" : "กม." };
}

export function formatSpeedKmh(metersPerSec?: number | null, unit: UnitSystem = "METRIC"): string {
  if (metersPerSec === null || metersPerSec === undefined) return "-";
  if (unit === "IMPERIAL") return `${(metersPerSec * 2.236936).toFixed(1)} ไมล์/ชม.`;
  return `${(metersPerSec * 3.6).toFixed(1)} กม./ชม.`;
}

// Running pace, expressed as minutes:seconds per km (or mile for imperial users).
export function formatPace(metersPerSec?: number | null, unit: UnitSystem = "METRIC"): string {
  if (!metersPerSec) return "-"; // pace is undefined (division by zero) at 0 speed, not just missing
  const perUnitMeters = unit === "IMPERIAL" ? METERS_PER_MILE : 1000;
  const secPerUnit = perUnitMeters / metersPerSec;
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  return `${m}:${s.toString().padStart(2, "0")} /${unit === "IMPERIAL" ? "ไมล์" : "กม."}`;
}

export function formatElevationM(meters?: number | null, unit: UnitSystem = "METRIC"): string {
  if (meters === null || meters === undefined) return "-";
  if (unit === "IMPERIAL") return `${Math.round(meters * 3.28084)} ฟุต`;
  return `${Math.round(meters)} ม.`;
}

// --- Signed deltas, for comparing one activity against another ---

export function formatSignedDistance(diffMeters: number, unit: UnitSystem = "METRIC"): string {
  const sign = diffMeters > 0 ? "+" : diffMeters < 0 ? "-" : "";
  const value = unit === "IMPERIAL" ? Math.abs(diffMeters) / METERS_PER_MILE : Math.abs(diffMeters) / 1000;
  return `${sign}${value.toFixed(2)} ${unit === "IMPERIAL" ? "ไมล์" : "กม."}`;
}

export function formatSignedDuration(diffSec: number): string {
  const sign = diffSec > 0 ? "+" : diffSec < 0 ? "-" : "";
  const abs = Math.round(Math.abs(diffSec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m > 0 ? `${m} นาที ${s} วิ` : `${s} วิ`}`;
}

export function formatSignedHeartRate(diffBpm: number): string {
  const sign = diffBpm > 0 ? "+" : diffBpm < 0 ? "-" : "";
  return `${sign}${Math.round(Math.abs(diffBpm))} bpm`;
}

// Pace expressed as seconds per unit distance — lower is faster. Used to
// diff two average speeds on a comparable (lower-is-better) time scale.
export function paceSecondsPerUnit(metersPerSec: number, unit: UnitSystem = "METRIC"): number {
  const perUnitMeters = unit === "IMPERIAL" ? METERS_PER_MILE : 1000;
  return perUnitMeters / metersPerSec;
}

export function formatSignedPace(diffSecPerUnit: number, unit: UnitSystem = "METRIC"): string {
  const sign = diffSecPerUnit > 0 ? "+" : diffSecPerUnit < 0 ? "-" : "";
  const abs = Math.round(Math.abs(diffSecPerUnit));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, "0")} /${unit === "IMPERIAL" ? "ไมล์" : "กม."}`;
}

export function formatSignedCount(diff: number): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  return `${sign}${Math.abs(diff)}`;
}

export function formatActivityDate(date: Date): string {
  return new Date(date).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ACTIVITY_LABELS: Record<string, string> = {
  Run: "วิ่ง",
  Ride: "ปั่นจักรยาน",
  VirtualRide: "ปั่นจักรยาน (เสมือน)",
  Walk: "เดิน",
  Hike: "เดินป่า",
  Swim: "ว่ายน้ำ",
  WeightTraining: "เวทเทรนนิ่ง",
  Workout: "ออกกำลังกาย",
  Football: "ฟุตบอล",
  Badminton: "แบดมินตัน",
};

export function activityTypeLabel(type: string): string {
  return ACTIVITY_LABELS[type] ?? type;
}
