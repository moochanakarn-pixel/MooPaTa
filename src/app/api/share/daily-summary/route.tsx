import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";
import { macrosForGrams } from "@/lib/food";
import { applyActivityBonus, computeTargets, isProfileComplete } from "@/lib/nutrition";
import { buildDayCounts, computeStreak, localDateKey } from "@/lib/streak";
import { activityTypeLabel, formatDistanceKm, formatDuration } from "@/lib/format";
import { cardStyle, iconCircleStyle, rowCardStyle, titleStyle } from "@/lib/share-card-styles";

const CAL_RING_SIZE = 260;
const CAL_RING_STROKE = 22;
const CAL_RING_RADIUS = (CAL_RING_SIZE - CAL_RING_STROKE) / 2;
const CAL_RING_CIRCUMFERENCE = 2 * Math.PI * CAL_RING_RADIUS;

const ALL_FIELDS = ["cal", "macro", "water", "exercise", "streak", "weight"] as const;
type FieldId = (typeof ALL_FIELDS)[number];

function isFieldId(v: string): v is FieldId {
  return (ALL_FIELDS as readonly string[]).includes(v);
}

// "YYYY-MM-DD" -> local noon that day, same convention as
// parseBackfillLoggedAt (never a future date, never absurdly old).
function parseDateParam(v: string | null): Date | null {
  if (!v) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== m - 1) return null;
  if (localDateKey(date) > localDateKey(new Date())) return null;
  return date;
}

// A downloadable, story-ratio (1080x1920) daily summary card — replaces
// the old CSV export from the dashboard. Same dark gradient + next/og
// renderer as the existing period/nutrition share cards (see
// src/app/api/share/period/route.tsx), just built for one specific day
// and with the set of blocks + their order chosen by the caller instead
// of fixed. Blocks with genuinely no data for the day (no activity logged,
// no weight logged) are silently skipped rather than showing an empty
// prompt in what's meant to be a shareable image.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const date = parseDateParam(url.searchParams.get("date"));
  if (!date) {
    return new Response("Invalid date", { status: 400 });
  }

  const fieldsParam = url.searchParams.get("fields");
  const requested = fieldsParam
    ? fieldsParam
        .split(",")
        .map((f) => f.trim())
        .filter(isFieldId)
    : [...ALL_FIELDS];
  const fields = requested.length > 0 ? requested : [...ALL_FIELDS];

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const isToday = localDateKey(date) === localDateKey(new Date());

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const needStreak = fields.includes("streak");
  const [foodLogs, waterAgg, activities, weightLogs, streakFoodLogs] = await Promise.all([
    db.foodLog.findMany({ where: { userId, loggedAt: { gte: dayStart, lte: dayEnd } }, include: { food: true } }),
    db.waterLog.aggregate({ where: { userId, loggedAt: { gte: dayStart, lte: dayEnd } }, _sum: { ml: true } }),
    db.activity.findMany({ where: { userId, startedAt: { gte: dayStart, lte: dayEnd } }, orderBy: { startedAt: "asc" } }),
    db.weightLog.findMany({ where: { userId, loggedAt: { lte: dayEnd } }, orderBy: { loggedAt: "desc" }, take: 2 }),
    needStreak
      ? db.foodLog.findMany({
          where: { userId, loggedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          select: { loggedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const macros = foodLogs.reduce(
    (acc, l) => {
      const m = macrosForGrams(l.food, l.grams);
      acc.calories += m.calories;
      acc.proteinG += m.proteinG;
      acc.carbG += m.carbG;
      acc.fatG += m.fatG;
      return acc;
    },
    { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
  );
  const waterMl = waterAgg._sum.ml ?? 0;
  const activityDurationSec = activities.reduce((s, a) => s + a.durationSec, 0);

  const profile = {
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    sex: user.sex,
    activityLevel: user.activityLevel,
    goal: user.nutritionGoal,
    goalRateKgPerWeek: user.goalRateKgPerWeek,
  };
  let targetCalories: number | null = null;
  let targetWaterMl: number | null = null;
  if (isProfileComplete(profile)) {
    const today = applyActivityBonus(computeTargets(profile), activityDurationSec);
    targetCalories = today.targetCalories;
    targetWaterMl = today.waterMl;
  }

  let streak: number | null = null;
  if (needStreak) {
    const days = buildDayCounts(
      streakFoodLogs.map((l) => l.loggedAt),
      30
    );
    streak = computeStreak(days).current;
  }

  const [latestWeight, prevWeight] = weightLogs;
  const weightDelta = latestWeight && prevWeight ? latestWeight.weightKg - prevWeight.weightKg : null;

  const dateLabel =
    (isToday ? "วันนี้ · " : "") +
    date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  const macroShares = [
    { label: "โปรตีน", grams: macros.proteinG, kcal: macros.proteinG * 4, color: "#38bdf8" },
    { label: "คาร์บ", grams: macros.carbG, kcal: macros.carbG * 4, color: "#f59e0b" },
    { label: "ไขมัน", grams: macros.fatG, kcal: macros.fatG * 9, color: "#f43f5e" },
  ];
  const macroKcalTotal = macroShares.reduce((s, m) => s + m.kcal, 0) || 1;

  let fonts;
  try {
    fonts = await loadShareFonts();
  } catch (err) {
    console.error("Daily summary share card: font load failed", err);
    return new Response(
      `Share card unavailable: could not load fonts (${err instanceof Error ? err.message : String(err)})`,
      { status: 500 }
    );
  }

  const pct = targetCalories ? Math.max(0, Math.min(100, (macros.calories / targetCalories) * 100)) : 0;

  // Each block is a small JSX fragment plus the flag that decides whether
  // it's worth showing at all — built once, then filtered/ordered by the
  // caller's `fields` list so "no data for this block" and "user turned
  // it off" both just mean "skip it".
  const blocks: Partial<Record<FieldId, { show: boolean; node: JSX.Element }>> = {
    cal: {
      show: true,
      node: (
        <div key="cal" style={rowCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
            <div style={{ display: "flex", position: "relative", width: CAL_RING_SIZE, height: CAL_RING_SIZE }}>
              <svg width={CAL_RING_SIZE} height={CAL_RING_SIZE} viewBox={`0 0 ${CAL_RING_SIZE} ${CAL_RING_SIZE}`}>
                <circle
                  cx={CAL_RING_SIZE / 2}
                  cy={CAL_RING_SIZE / 2}
                  r={CAL_RING_RADIUS}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={CAL_RING_STROKE}
                  fill="none"
                />
                <circle
                  cx={CAL_RING_SIZE / 2}
                  cy={CAL_RING_SIZE / 2}
                  r={CAL_RING_RADIUS}
                  stroke="#fc4c02"
                  strokeWidth={CAL_RING_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={CAL_RING_CIRCUMFERENCE}
                  strokeDashoffset={CAL_RING_CIRCUMFERENCE * (1 - pct / 100)}
                  transform={`rotate(-90 ${CAL_RING_SIZE / 2} ${CAL_RING_SIZE / 2})`}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 62, fontWeight: 700, color: "white" }}>{Math.round(macros.calories).toLocaleString("th-TH")}</span>
                <span style={{ fontSize: 26, color: "#a3a3a3" }}>kcal</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 32, color: "#d4d4d4" }}>
                {targetCalories ? `จากเป้า ${targetCalories.toLocaleString("th-TH")} kcal` : "แคลอรี่วันนี้"}
              </span>
              {targetCalories && (
                <span style={{ fontSize: 27, color: "#8f8f8a" }}>
                  {macros.calories <= targetCalories
                    ? `เหลืออีก ${Math.round(targetCalories - macros.calories).toLocaleString("th-TH")} kcal`
                    : `เกินเป้า ${Math.round(macros.calories - targetCalories).toLocaleString("th-TH")} kcal`}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    macro: {
      show: true,
      node: (
        <div key="macro" style={cardStyle}>
          <span style={titleStyle}>แมโคร</span>
          <div style={{ display: "flex", height: 28, borderRadius: 999, overflow: "hidden", marginTop: 22 }}>
            {macroShares.map((m) => (
              <div key={m.label} style={{ display: "flex", width: `${(m.kcal / macroKcalTotal) * 100}%`, background: m.color }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 44, marginTop: 26 }}>
            {macroShares.map((m) => (
              <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: m.color }} />
                <span style={{ fontSize: 27, color: "#b5b5b0" }}>{m.label}</span>
                <span style={{ fontSize: 30, fontWeight: 700, color: "white" }}>{Math.round(m.grams)} ก.</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    water: {
      show: true,
      node: (
        <div key="water" style={{ ...rowCardStyle, alignItems: "center" }}>
          <div style={iconCircleStyle("rgba(56,189,248,0.16)")}>
            <WaterIcon />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: "white" }}>
              {`${(waterMl / 1000).toFixed(1)} ลิตร` + (targetWaterMl ? ` / ${(targetWaterMl / 1000).toFixed(1)} ลิตร` : "")}
            </span>
            <span style={{ fontSize: 26, color: "#9c9c97" }}>น้ำดื่มวันนี้</span>
          </div>
        </div>
      ),
    },
    exercise: {
      show: activities.length > 0,
      node: (
        <div key="exercise" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={titleStyle}>ออกกำลังกาย</span>
            <span style={badgeStyle}>ซิงก์จาก Strava</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 22 }}>
            {activities.slice(0, 4).map((a, i) => (
              <div key={a.id ?? i} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <div style={{ ...iconCircleStyle("rgba(252,76,2,0.16)"), width: 68, height: 68 }}>
                  <RunIcon />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: "white" }}>{activityTypeLabel(a.type)}</span>
                  <span style={{ fontSize: 25, color: "#9c9c97" }}>
                    {[
                      a.distanceMeters ? formatDistanceKm(a.distanceMeters, user.unitSystem) : null,
                      formatDuration(a.durationSec),
                      a.calories ? `${Math.round(a.calories)} kcal` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    streak: {
      show: streak !== null && streak > 0,
      node: (
        <div key="streak" style={{ ...rowCardStyle, alignItems: "center" }}>
          <div style={iconCircleStyle("rgba(252,76,2,0.16)")}>
            <FlameIcon />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: "white" }}>{streak} วันติดต่อกัน</span>
            <span style={{ fontSize: 26, color: "#9c9c97" }}>สตรีคบันทึกอาหาร</span>
          </div>
        </div>
      ),
    },
    weight: {
      show: !!latestWeight,
      node: (
        <div key="weight" style={{ ...rowCardStyle, alignItems: "center" }}>
          <div style={iconCircleStyle("rgba(163,230,53,0.15)")}>
            <ScaleIcon />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: "white" }}>
              {latestWeight ? `${latestWeight.weightKg.toFixed(1)} กก.` : "—"}
            </span>
            <span style={{ fontSize: 26, color: "#9c9c97" }}>
              {weightDelta !== null
                ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} กก. จากครั้งก่อน`
                : "น้ำหนักล่าสุด"}
            </span>
          </div>
        </div>
      ),
    },
  };

  const orderedBlocks = fields.map((f) => blocks[f]).filter((b): b is { show: boolean; node: JSX.Element } => !!b && b.show);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #0b0f19 0%, #14170f 55%, #0e1c08 100%)",
          padding: 64,
          fontFamily: "Noto Sans Thai",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #fc4c02, #ff8a3d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
              color: "white",
            }}
          >
            M
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "white" }}>MooPaTa</span>
            <span style={{ fontSize: 20, color: "#a3a3a3" }}>{dateLabel}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            marginTop: 28,
            padding: "10px 24px",
            borderRadius: 999,
            background: "rgba(163,230,53,0.15)",
            color: "#a3e635",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          สรุปผลประจำวัน
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: orderedBlocks.length > 1 ? "space-around" : "center",
            gap: 40,
            marginTop: 32,
            marginBottom: 32,
          }}
        >
          {orderedBlocks.map((b) => b.node)}
        </div>

        <div style={{ display: "flex", justifyContent: "center", fontSize: 22, color: "rgba(255,255,255,0.35)" }}>
          moopata.mcnkth.com
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts }
  );

  const buffer = await image.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="moopata-summary-${localDateKey(date)}.png"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}

const badgeStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#fc4c02",
  background: "rgba(252,76,2,0.16)",
  padding: "8px 20px",
  borderRadius: 999,
};

function WaterIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.5c2.8 3.6 6 8 6 11.3a6 6 0 0 1-12 0c0-3.3 3.2-7.7 6-11.3Z"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 20 20" fill="none">
      <path d="M4 16 8 9l3 3 5-7" stroke="#fc4c02" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 5h3v3" stroke="#fc4c02" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.8-2.5.3.9 1 1.3 1.5 1 .5-2.3-1-3.5-1-5.5C7.9 3.6 8.9 2.6 10 2Z"
        stroke="#fc4c02"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3v2M6 5h8l1.5 8a2 2 0 0 1-2 2.3H6.5A2 2 0 0 1 4.5 13L6 5Z"
        stroke="#a3e635"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
