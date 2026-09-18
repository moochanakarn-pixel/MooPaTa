// Text content for the Satori-rendered share/download card images
// (src/app/api/share/*/route.tsx). Kept separate from messages/th.json +
// messages/en.json (the app UI's own next-intl catalog) because these
// routes are plain Route Handlers, not part of the React tree next-intl's
// provider wraps, and the two have nothing to do with each other: someone
// can browse the app in Thai and still download an English-language card
// (or vice versa) — see ShareLang below.
export type ShareLang = "th" | "en";

function isShareLang(v: string | null): v is ShareLang {
  return v === "th" || v === "en";
}

// Reads `?lang=` off any share route's query string, defaulting to
// `fallback` (normally the viewer's current app locale, passed in by the
// caller) when missing or invalid — so a plain right-click "save image"
// with no query string still matches whatever language the button that
// generated the link was showing.
export function parseShareLang(searchParams: URLSearchParams, fallback: ShareLang = "th"): ShareLang {
  const raw = searchParams.get("lang");
  return isShareLang(raw) ? raw : fallback;
}

const dict = {
  th: {
    prBadge: (name: string, weightKg: number) => `PR ${name} ${weightKg} กก.`,
    longestDistanceBadge: "ระยะทางไกลที่สุด",
    fastestPaceBadge: "เพซเร็วที่สุด",
    fastestSpeedBadge: "ความเร็วสูงสุด",
    timeLabel: "เวลา",
    avgPaceLabel: "เพซเฉลี่ย",
    avgSpeedLabel: "ความเร็วเฉลี่ย",
    maxPaceLabel: "เพซสูงสุด",
    maxSpeedLabel: "ความเร็วสูงสุด",
    elevationLabel: "ไต่ระดับ",
    avgHrLabel: "หัวใจเฉลี่ย",
    maxHrLabel: "หัวใจสูงสุด",
    avgCadenceLabel: "เคเดนซ์เฉลี่ย",
    caloriesLabel: "แคลอรี่",
    hoursUnit: "ชม.",
    minutesUnit: "นาที",

    weekSummaryBadge: "สรุปสัปดาห์นี้",
    monthSummaryBadge: "สรุปเดือนนี้",
    longestPrefix: (name: string) => `ไกลที่สุด: ${name}`,
    activitiesLabel: "กิจกรรม",
    totalTimeLabel: "เวลารวม",
    totalElevationLabel: "ไต่ระดับรวม",
    timesSuffix: (n: number) => `${n} ครั้ง`,

    monthlyNutritionBadge: "สรุปโภชนาการเดือนนี้",
    avgKcalPerDaySuffix: "kcal/วัน เฉลี่ย",
    foodLoggedLabel: "บันทึกอาหารแล้ว",
    daysOfLabel: (logged: number, total: number) => `${logged}/${total} วัน`,
    avgMacroPerDayLabel: "แมโครเฉลี่ย/วัน",
    proteinLabel: "โปรตีน",
    carbLabel: "คาร์บ",
    fatLabel: "ไขมัน",
    gramsValue: (n: number) => `${n} ก.`,
    avgWaterPerDayLabel: "น้ำดื่มเฉลี่ย/วัน",
    litersValue: (n: string) => `${n} ลิตร`,
    weightChangeLabel: "น้ำหนักเปลี่ยนแปลง",
    kgValue: (n: string) => `${n} กก.`,
    noDataDash: "—",

    greeting: (name: string) => `สวัสดี, ${name}`,
    defaultName: "นักวิ่ง",
    dailySummaryBadge: "สรุปผลประจำวัน",
    todayPrefix: "วันนี้ · ",
    fromTargetKcal: (target: string) => `จากเป้า ${target} kcal`,
    todayCaloriesLabel: "แคลอรี่วันนี้",
    remainingKcal: (n: string) => `เหลืออีก ${n} kcal`,
    overTargetKcal: (n: string) => `เกินเป้า ${n} kcal`,
    macroTitle: "แมโคร",
    todayWaterLabel: "น้ำดื่มวันนี้",
    litersOfTarget: (value: string, target: string) => `${value} ลิตร / ${target} ลิตร`,
    exerciseTitle: "ออกกำลังกาย",
    monthlyGoalTitle: "เป้าหมายระยะทางเดือนนี้",
    consistencyTitle: "ความสม่ำเสมอ 7 วันล่าสุด",
    streakDays: (n: number) => `${n} วันติดต่อกัน`,
    foodStreakLabel: "สตรีคบันทึกอาหาร",
    latestWeightLabel: "น้ำหนักล่าสุด",
    weightDeltaFromPrev: (signed: string) => `${signed} จากครั้งก่อน`,

    // ?style=list on the single-activity card (src/app/api/share/[id]) —
    // the full exercise/set breakdown, not the grid/hero cards' summary
    // numbers. setLine mirrors activity/[id]/page.tsx's own inline
    // "{reps} ครั้ง × {weightKg} กก. (RPE {rpe})" formatting, so the card
    // reads the same as the page it was captured from — combined into one
    // string (rather than a separate label span + detail span, which this
    // used to be) because a session with many sets renders one Satori text
    // node per span, and that per-node cost is what made list-style renders
    // for a realistic multi-exercise session take tens of seconds (see the
    // perf comment above `EXERCISE_TITLE_HEIGHT` in the route) — halving
    // the text nodes per set directly cuts that cost.
    exercisesListTitle: "ท่าออกกำลังกาย",
    setLine: (n: number, reps: number, weightKg: number | null, rpe: number | null) =>
      `เซ็ท ${n}: ${reps} ครั้ง${weightKg !== null ? ` × ${weightKg} กก.` : ""}${rpe !== null ? ` (RPE ${rpe})` : ""}`,
    noExercisesText: "ยังไม่มีท่าออกกำลังกายบันทึกไว้",
    // Shown when MAX_LIST_SETS truncated the exercise list (see the perf
    // comment in the route) — always says so rather than silently dropping
    // the rest, matching this project's "truncate visibly, never silently"
    // convention (e.g. Activity.notes' 500-char cutoff).
    listTruncatedNote: (n: number) => `+ อีก ${n} เซ็ทไม่แสดงในรูปนี้ (เซสชันยาวเกินไป)`,
  },
  en: {
    prBadge: (name: string, weightKg: number) => `PR ${name} ${weightKg} kg`,
    longestDistanceBadge: "Longest distance",
    fastestPaceBadge: "Fastest pace",
    fastestSpeedBadge: "Fastest speed",
    timeLabel: "Time",
    avgPaceLabel: "Avg pace",
    avgSpeedLabel: "Avg speed",
    maxPaceLabel: "Max pace",
    maxSpeedLabel: "Max speed",
    elevationLabel: "Elevation",
    avgHrLabel: "Avg HR",
    maxHrLabel: "Max HR",
    avgCadenceLabel: "Avg cadence",
    caloriesLabel: "Calories",
    hoursUnit: "hr",
    minutesUnit: "min",

    weekSummaryBadge: "This week's summary",
    monthSummaryBadge: "This month's summary",
    longestPrefix: (name: string) => `Longest: ${name}`,
    activitiesLabel: "Activities",
    totalTimeLabel: "Total time",
    totalElevationLabel: "Total elevation",
    timesSuffix: (n: number) => `${n}x`,

    monthlyNutritionBadge: "This month's nutrition summary",
    avgKcalPerDaySuffix: "kcal/day avg",
    foodLoggedLabel: "Food logged",
    daysOfLabel: (logged: number, total: number) => `${logged}/${total} days`,
    avgMacroPerDayLabel: "Avg macros/day",
    proteinLabel: "Protein",
    carbLabel: "Carb",
    fatLabel: "Fat",
    gramsValue: (n: number) => `${n} g`,
    avgWaterPerDayLabel: "Avg water/day",
    litersValue: (n: string) => `${n} L`,
    weightChangeLabel: "Weight change",
    kgValue: (n: string) => `${n} kg`,
    noDataDash: "—",

    greeting: (name: string) => `Hi, ${name}`,
    defaultName: "Runner",
    dailySummaryBadge: "Daily summary",
    todayPrefix: "Today · ",
    fromTargetKcal: (target: string) => `of ${target} kcal target`,
    todayCaloriesLabel: "Today's calories",
    remainingKcal: (n: string) => `${n} kcal left`,
    overTargetKcal: (n: string) => `${n} kcal over`,
    macroTitle: "Macros",
    todayWaterLabel: "Today's water",
    litersOfTarget: (value: string, target: string) => `${value} L / ${target} L`,
    exerciseTitle: "Exercise",
    monthlyGoalTitle: "This month's distance goal",
    consistencyTitle: "Last 7 days consistency",
    streakDays: (n: number) => `${n} day streak`,
    foodStreakLabel: "Food logging streak",
    latestWeightLabel: "Latest weight",
    weightDeltaFromPrev: (signed: string) => `${signed} from last`,

    exercisesListTitle: "Exercises",
    setLine: (n: number, reps: number, weightKg: number | null, rpe: number | null) =>
      `Set ${n}: ${reps} reps${weightKg !== null ? ` × ${weightKg} kg` : ""}${rpe !== null ? ` (RPE ${rpe})` : ""}`,
    noExercisesText: "No exercises logged",
    listTruncatedNote: (n: number) => `+ ${n} more sets not shown (session too long for one image)`,
  },
};

export function shareT(lang: ShareLang): (typeof dict)["th"] {
  return dict[lang];
}
