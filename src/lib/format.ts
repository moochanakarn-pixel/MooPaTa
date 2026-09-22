// `lang` is only used by the share-card image routes (src/app/api/share/*),
// which render bilingual PNGs on demand and are the one place in the app
// where the same request can ask for either language regardless of the
// viewer's own UI locale (src/lib/locale.ts) — every other call site in the
// app (records, compare, activity detail, month-highlights, etc.) doesn't
// pass it and keeps getting Thai, unaffected by this addition.
export type FormatLang = "th" | "en";

export function formatDuration(sec: number, lang: FormatLang = "th"): string {
  // Round to the nearest whole minute FIRST, then split into h/m from that
  // single integer — rounding h and m separately (as this used to) lets m
  // round up to 60 without carrying into h (e.g. 7190s = 1h59m50s used to
  // print "1h 60m" instead of "2h 0m"), the same class of bug formatPace/
  // formatSwimPace had below and the formatSigned* variants already avoid.
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (lang === "en") return h > 0 ? `${h}h ${m}m` : `${m}m`;
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} นาที`;
}

export type UnitSystem = "METRIC" | "IMPERIAL";
const METERS_PER_MILE = 1609.344;

export function formatDistanceKm(meters?: number | null, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  if (meters === null || meters === undefined) return "-";
  if (unit === "IMPERIAL") return `${(meters / METERS_PER_MILE).toFixed(2)} ${lang === "en" ? "mi" : "ไมล์"}`;
  return `${(meters / 1000).toFixed(2)} ${lang === "en" ? "km" : "กม."}`;
}

// Split value/unit, for hero-sized stat displays that render the number and
// unit at different font sizes (e.g. the share card).
export function formatDistanceParts(
  meters: number | null,
  unit: UnitSystem = "METRIC",
  lang: FormatLang = "th"
): { value: string; unitLabel: string } {
  const value = unit === "IMPERIAL" ? (meters ?? 0) / METERS_PER_MILE : (meters ?? 0) / 1000;
  const unitLabel = unit === "IMPERIAL" ? (lang === "en" ? "mi" : "ไมล์") : lang === "en" ? "km" : "กม.";
  return { value: value.toFixed(2), unitLabel };
}

export function formatSpeedKmh(metersPerSec?: number | null, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  if (metersPerSec === null || metersPerSec === undefined) return "-";
  if (unit === "IMPERIAL") return `${(metersPerSec * 2.236936).toFixed(1)} ${lang === "en" ? "mph" : "ไมล์/ชม."}`;
  return `${(metersPerSec * 3.6).toFixed(1)} ${lang === "en" ? "km/h" : "กม./ชม."}`;
}

// Running pace, expressed as minutes:seconds per km (or mile for imperial users).
export function formatPace(metersPerSec?: number | null, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  if (!metersPerSec) return "-"; // pace is undefined (division by zero) at 0 speed, not just missing
  const perUnitMeters = unit === "IMPERIAL" ? METERS_PER_MILE : 1000;
  const secPerUnit = perUnitMeters / metersPerSec;
  // Round the total seconds first, then derive m/s from that one integer —
  // rounding s on its own (this used to do `Math.round(secPerUnit % 60)`)
  // can round up to 60 without carrying into m. A real 6:00/km pace stored
  // as avgSpeedMs and read back through MySQL/Prisma came back as
  // 359.99999999999994 (floating-point round-trip noise) often enough to
  // hit this: floor(359.99.../60)=5, round(359.99...%60)=round(59.99...)=60,
  // printing the invalid "5:60" instead of "6:00".
  const totalSec = Math.round(secPerUnit);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")} /${unit === "IMPERIAL" ? (lang === "en" ? "mi" : "ไมล์") : lang === "en" ? "km" : "กม."}`;
}

const YARDS_PER_100 = 91.44; // 100 yd, the customary imperial-pool swim distance

// Swimming pace, expressed as minutes:seconds per 100m (or 100yd for
// imperial units) — the convention swimmers actually use, distinct from
// formatPace's per-km/mile running convention. Nobody describes swim effort
// as "minutes per kilometer."
export function formatSwimPace(metersPerSec?: number | null, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  if (!metersPerSec) return "-";
  const perUnitMeters = unit === "IMPERIAL" ? YARDS_PER_100 : 100;
  const secPerUnit = perUnitMeters / metersPerSec;
  // Same round-total-first fix as formatPace above — see its comment.
  const totalSec = Math.round(secPerUnit);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")} /${unit === "IMPERIAL" ? (lang === "en" ? "100yd" : "100 หลา") : lang === "en" ? "100m" : "100 ม."}`;
}

// The one place that decides which "how fast" convention an activity type
// gets — running pace for Run, swimming pace for Swim, plain km/h (or mph)
// speed for everything else (cycling etc., where "pace" isn't how people
// talk about effort). Used everywhere an activity's avg/max speed is shown
// so every page picks the same convention the same way, instead of each
// call site re-deriving its own isRun-only check that quietly showed
// swimming in the cycling convention (km/h) — swimmers don't think in km/h.
export function activitySpeedValue(
  type: string,
  metersPerSec?: number | null,
  unit: UnitSystem = "METRIC",
  lang: FormatLang = "th"
): string {
  if (type === "Run") return formatPace(metersPerSec, unit, lang);
  if (type === "Swim") return formatSwimPace(metersPerSec, unit, lang);
  return formatSpeedKmh(metersPerSec, unit, lang);
}

// Cadence's unit depends on the activity the same way pace/speed does
// (activitySpeedValue above) — cycling cadence is pedal revolutions per
// minute (rpm), everything else (running, walking) counts steps per minute
// (spm). Every display site used to hardcode "rpm" unconditionally, a
// leftover from when avgCadence only ever came from Strava-synced cycling
// activities — harmless while dormant, but wrong the moment a manually
// logged/AI-imported run started populating the same field with a spm
// reading labeled as rpm.
export function cadenceUnitLabel(type: string): string {
  return type === "Ride" ? "rpm" : "spm";
}

export function formatElevationM(meters?: number | null, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  if (meters === null || meters === undefined) return "-";
  if (unit === "IMPERIAL") return `${Math.round(meters * 3.28084)} ${lang === "en" ? "ft" : "ฟุต"}`;
  return `${Math.round(meters)} ${lang === "en" ? "m" : "ม."}`;
}

// --- Signed deltas, for comparing one activity against another ---

export function formatSignedElevation(diffMeters: number, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  const sign = diffMeters > 0 ? "+" : diffMeters < 0 ? "-" : "";
  const value = unit === "IMPERIAL" ? Math.abs(diffMeters) * 3.28084 : Math.abs(diffMeters);
  const unitLabel = unit === "IMPERIAL" ? (lang === "en" ? "ft" : "ฟุต") : lang === "en" ? "m" : "ม.";
  return `${sign}${Math.round(value)} ${unitLabel}`;
}

export function formatSignedDistance(diffMeters: number, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  const sign = diffMeters > 0 ? "+" : diffMeters < 0 ? "-" : "";
  const value = unit === "IMPERIAL" ? Math.abs(diffMeters) / METERS_PER_MILE : Math.abs(diffMeters) / 1000;
  const unitLabel = unit === "IMPERIAL" ? (lang === "en" ? "mi" : "ไมล์") : lang === "en" ? "km" : "กม.";
  return `${sign}${value.toFixed(2)} ${unitLabel}`;
}

export function formatSignedDuration(diffSec: number, lang: FormatLang = "th"): string {
  const sign = diffSec > 0 ? "+" : diffSec < 0 ? "-" : "";
  const abs = Math.round(Math.abs(diffSec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (lang === "en") return `${sign}${m > 0 ? `${m}m ${s}s` : `${s}s`}`;
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

export function formatSignedPace(diffSecPerUnit: number, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  const sign = diffSecPerUnit > 0 ? "+" : diffSecPerUnit < 0 ? "-" : "";
  const abs = Math.round(Math.abs(diffSecPerUnit));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const unitLabel = unit === "IMPERIAL" ? (lang === "en" ? "mi" : "ไมล์") : lang === "en" ? "km" : "กม.";
  return `${sign}${m}:${s.toString().padStart(2, "0")} /${unitLabel}`;
}

// Swimming counterparts of paceSecondsPerUnit/formatSignedPace above — per
// 100m/100yd instead of per km/mile, for diffing two swim activities'
// average pace. Kept separate rather than parameterizing the existing pair
// since the two are never mixed (a diff is only ever meaningful between two
// activities of the same type).
export function swimPaceSecondsPerUnit(metersPerSec: number, unit: UnitSystem = "METRIC"): number {
  const perUnitMeters = unit === "IMPERIAL" ? YARDS_PER_100 : 100;
  return perUnitMeters / metersPerSec;
}

export function formatSignedSwimPace(diffSecPerUnit: number, unit: UnitSystem = "METRIC", lang: FormatLang = "th"): string {
  const sign = diffSecPerUnit > 0 ? "+" : diffSecPerUnit < 0 ? "-" : "";
  const abs = Math.round(Math.abs(diffSecPerUnit));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const unitLabel = unit === "IMPERIAL" ? (lang === "en" ? "100yd" : "100 หลา") : lang === "en" ? "100m" : "100 ม.";
  return `${sign}${m}:${s.toString().padStart(2, "0")} /${unitLabel}`;
}

export function formatSignedCount(diff: number): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  return `${sign}${Math.abs(diff)}`;
}

export function formatActivityDate(date: Date, lang: FormatLang = "th"): string {
  return new Date(date).toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {
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
  Soccer: "ฟุตบอล", // Strava's real sport_type value for football — "Football" above is only used by the manual-log form
  Badminton: "แบดมินตัน",
};

// English map exists only for the share-card image routes (see FormatLang's
// comment above) — every other page that shows an activity type stays Thai
// via the default, same as the rest of this file's lang param.
const ACTIVITY_LABELS_EN: Record<string, string> = {
  Run: "Run",
  Ride: "Ride",
  VirtualRide: "Virtual Ride",
  Walk: "Walk",
  Hike: "Hike",
  Swim: "Swim",
  WeightTraining: "Weight Training",
  Workout: "Workout",
  Football: "Football",
  Soccer: "Football",
  Badminton: "Badminton",
};

export function activityTypeLabel(type: string, lang: FormatLang = "th"): string {
  if (lang === "en") return ACTIVITY_LABELS_EN[type] ?? type;
  return ACTIVITY_LABELS[type] ?? type;
}
