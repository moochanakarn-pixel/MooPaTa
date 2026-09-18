import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { macrosForGrams } from "@/lib/food";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";
import { loadMascotLogoDataUri } from "@/lib/share-logo";
import { cardStyle, rowCardStyle } from "@/lib/share-card-styles";
import { parseShareLang, shareT } from "@/lib/share-card-i18n";

// "Wrapped"-style monthly nutrition summary — same story-ratio PNG as the
// activity period card (src/app/api/share/period/route.tsx), but built from
// FoodLog/WaterLog/WeightLog instead of Activity. Deliberately shows no
// vs.-target numbers: those need a completed nutrition profile, and this
// card should still be worth sharing for someone who's just logging food
// without ever filling one in.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = new URL(req.url).searchParams;
  const lang = parseShareLang(searchParams);
  const t = shareT(lang);
  // Same ?bg=transparent option as the activity/daily-summary/period share
  // cards — see api/share/[id]/route.tsx's fuller comment on why
  // textShadow/badgeBg need to change shape, not just toggle, once the
  // card's own dark backdrop is gone.
  const transparent = searchParams.get("bg") === "transparent";

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateLocale = lang === "en" ? "en-US" : "th-TH";
  const dateRangeLabel = `${periodStart.toLocaleDateString(dateLocale, { day: "numeric", month: "short" })} – ${now.toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}`;
  const daysElapsed = Math.floor((now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  const [foodLogs, waterAgg, weightLogs] = await Promise.all([
    db.foodLog.findMany({ where: { userId, loggedAt: { gte: periodStart } }, include: { food: true } }),
    db.waterLog.aggregate({ where: { userId, loggedAt: { gte: periodStart } }, _sum: { ml: true } }),
    db.weightLog.findMany({ where: { userId, loggedAt: { gte: periodStart } }, orderBy: { loggedAt: "asc" } }),
  ]);

  const totals = foodLogs.reduce(
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
  const loggedDays = new Set(foodLogs.map((l) => l.loggedAt.toDateString())).size;
  const avgCalories = loggedDays > 0 ? totals.calories / loggedDays : 0;
  const avgProtein = loggedDays > 0 ? totals.proteinG / loggedDays : 0;
  const avgCarb = loggedDays > 0 ? totals.carbG / loggedDays : 0;
  const avgFat = loggedDays > 0 ? totals.fatG / loggedDays : 0;
  const avgWaterL = (waterAgg._sum.ml ?? 0) / 1000 / daysElapsed;

  const firstWeight = weightLogs[0]?.weightKg ?? null;
  const lastWeight = weightLogs[weightLogs.length - 1]?.weightKg ?? null;
  const weightDelta = firstWeight !== null && lastWeight !== null ? lastWeight - firstWeight : null;

  const macroKcalTotal = avgProtein * 4 + avgCarb * 4 + avgFat * 9 || 1;
  const macroShares = [
    { label: t.proteinLabel, grams: avgProtein, kcal: avgProtein * 4, color: "#38bdf8" },
    { label: t.carbLabel, grams: avgCarb, kcal: avgCarb * 4, color: "#f59e0b" },
    { label: t.fatLabel, grams: avgFat, kcal: avgFat * 9, color: "#f43f5e" },
  ];

  let fonts;
  let mascotLogo;
  try {
    [fonts, mascotLogo] = await Promise.all([loadShareFonts(), loadMascotLogoDataUri()]);
  } catch (err) {
    console.error("Nutrition share card: font/logo load failed", err);
    return new Response(
      `Share card unavailable: could not load fonts (${err instanceof Error ? err.message : String(err)})`,
      { status: 500 }
    );
  }

  const textShadow = transparent
    ? "-2px -2px 3px rgba(0,0,0,0.9), 2px -2px 3px rgba(0,0,0,0.9), -2px 2px 3px rgba(0,0,0,0.9), 2px 2px 3px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)"
    : "none";
  const badgeBg = (rgb: string) => (transparent ? `rgba(${rgb},0.55)` : `rgba(${rgb},0.15)`);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: transparent ? "transparent" : "linear-gradient(160deg, #0b0f19 0%, #14170f 55%, #0e1c08 100%)",
          padding: 64,
          fontFamily: "Noto Sans Thai",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mascotLogo} width={56} height={56} style={{ borderRadius: 14 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "white", textShadow }}>MooPaTa</span>
            <span style={{ fontSize: 20, color: "#a3a3a3", textShadow }}>{dateRangeLabel}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            marginTop: 28,
            padding: "10px 24px",
            borderRadius: 999,
            background: badgeBg("163,230,53"),
            color: "#a3e635",
            fontSize: 26,
            fontWeight: 700,
            textShadow,
          }}
        >
          {t.monthlyNutritionBadge}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-around", gap: 40, marginTop: 32, marginBottom: 32 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ fontSize: 100, fontWeight: 700, color: "white", lineHeight: 1, textShadow }}>
                {Math.round(avgCalories).toLocaleString(dateLocale)}
              </span>
              <span style={{ fontSize: 34, fontWeight: 700, color: "#a3a3a3", textShadow }}>{t.avgKcalPerDaySuffix}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
              <span style={{ fontSize: 28 }}>📝</span>
              <span style={{ fontSize: 26, color: "#d4d4d4", textShadow }}>{t.foodLoggedLabel}</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: "white", textShadow }}>{t.daysOfLabel(loggedDays, daysElapsed)}</span>
            </div>
          </div>

          <div style={cardStyle}>
            <span style={{ fontSize: 27, fontWeight: 700, color: "#c9c9c4", letterSpacing: 0.5, textShadow }}>{t.avgMacroPerDayLabel}</span>
            <div style={{ display: "flex", height: 28, borderRadius: 999, overflow: "hidden", marginTop: 22 }}>
              {macroShares.map((m) => (
                <div
                  key={m.label}
                  style={{ display: "flex", width: `${(m.kcal / macroKcalTotal) * 100}%`, background: m.color }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 44, marginTop: 26 }}>
              {macroShares.map((m) => (
                <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: m.color }} />
                  <span style={{ fontSize: 27, color: "#b5b5b0", textShadow }}>{m.label}</span>
                  <span style={{ fontSize: 30, fontWeight: 700, color: "white", textShadow }}>{t.gramsValue(Math.round(m.grams))}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={rowCardStyle}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 42, fontWeight: 700, color: "white", textShadow }}>{t.litersValue(avgWaterL.toFixed(1))}</span>
              <span style={{ fontSize: 26, color: "#9c9c97", textShadow }}>{t.avgWaterPerDayLabel}</span>
            </div>
          </div>

          <div style={rowCardStyle}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 42, fontWeight: 700, color: "white", textShadow }}>
                {weightDelta !== null ? t.kgValue(`${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)}`) : t.noDataDash}
              </span>
              <span style={{ fontSize: 26, color: "#9c9c97", textShadow }}>{t.weightChangeLabel}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts,
    }
  );

  const buffer = await image.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="moopata-nutrition-summary.png"`,
      // Short private cache keyed by the full URL (bg/lang) — see
      // api/share/[id]/route.tsx's fuller comment on the same header.
      "Cache-Control": "private, max-age=120",
    },
  });
}
