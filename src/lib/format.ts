export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} นาที`;
}

export function formatDistanceKm(meters?: number | null): string {
  if (!meters) return "-";
  return `${(meters / 1000).toFixed(2)} กม.`;
}

export function formatSpeedKmh(metersPerSec?: number | null): string {
  if (!metersPerSec) return "-";
  return `${(metersPerSec * 3.6).toFixed(1)} กม./ชม.`;
}

// Running pace, expressed as minutes:seconds per kilometer.
export function formatPace(metersPerSec?: number | null): string {
  if (!metersPerSec) return "-";
  const secPerKm = 1000 / metersPerSec;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")} /กม.`;
}

export function formatElevationM(meters?: number | null): string {
  if (meters === null || meters === undefined) return "-";
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
