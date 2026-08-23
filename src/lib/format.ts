export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} นาที`;
}

export type UnitSystem = "METRIC" | "IMPERIAL";
const METERS_PER_MILE = 1609.344;

export function formatDistanceKm(meters?: number | null, unit: UnitSystem = "METRIC"): string {
  if (!meters) return "-";
  if (unit === "IMPERIAL") return `${(meters / METERS_PER_MILE).toFixed(2)} ไมล์`;
  return `${(meters / 1000).toFixed(2)} กม.`;
}

export function formatSpeedKmh(metersPerSec?: number | null, unit: UnitSystem = "METRIC"): string {
  if (!metersPerSec) return "-";
  if (unit === "IMPERIAL") return `${(metersPerSec * 2.236936).toFixed(1)} ไมล์/ชม.`;
  return `${(metersPerSec * 3.6).toFixed(1)} กม./ชม.`;
}

// Running pace, expressed as minutes:seconds per km (or mile for imperial users).
export function formatPace(metersPerSec?: number | null, unit: UnitSystem = "METRIC"): string {
  if (!metersPerSec) return "-";
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
};

export function activityTypeLabel(type: string): string {
  return ACTIVITY_LABELS[type] ?? type;
}
