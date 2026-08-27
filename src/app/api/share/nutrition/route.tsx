import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { macrosForGrams } from "@/lib/food";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";

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

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateRangeLabel = `${periodStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} – ${now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`;
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
    { label: "โปรตีน", grams: avgProtein, kcal: avgProtein * 4, color: "#38bdf8" },
    { label: "คาร์บ", grams: avgCarb, kcal: avgCarb * 4, color: "#f59e0b" },
    { label: "ไขมัน", grams: avgFat, kcal: avgFat * 9, color: "#f43f5e" },
  ];

  let fonts;
  try {
    fonts = await loadShareFonts();
  } catch (err) {
    console.error("Nutrition share card: font load failed", err);
    return new Response(
      `Share card unavailable: could not load fonts (${err instanceof Error ? err.message : String(err)})`,
      { status: 500 }
    );
  }

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
              background: "linear-gradient(135deg, #a3e635, #4d7c0f)",
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
            <span style={{ fontSize: 20, color: "#a3a3a3" }}>{dateRangeLabel}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 32 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 24px",
              borderRadius: 999,
              background: "rgba(163,230,53,0.15)",
              color: "#a3e635",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            สรุปโภชนาการเดือนนี้
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 140, fontWeight: 700, color: "white", lineHeight: 1 }}>
              {Math.round(avgCalories).toLocaleString("th-TH")}
            </span>
            <span style={{ fontSize: 40, fontWeight: 700, color: "#a3a3a3" }}>kcal/วัน เฉลี่ย</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>📝</span>
            <span style={{ fontSize: 24, color: "#d4d4d4" }}>บันทึกอาหารแล้ว</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "white" }}>
              {loggedDays}/{daysElapsed} วัน
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", height: 20, width: 520, borderRadius: 999, overflow: "hidden" }}>
              {macroShares.map((m) => (
                <div
                  key={m.label}
                  style={{ display: "flex", width: `${(m.kcal / macroKcalTotal) * 100}%`, background: m.color }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 32 }}>
              {macroShares.map((m) => (
                <div key={m.label} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: m.color }} />
                    <span style={{ fontSize: 20, color: "#a3a3a3" }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "white" }}>{Math.round(m.grams)} ก./วัน</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 48, marginTop: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: "white" }}>{avgWaterL.toFixed(1)} ล.</span>
              <span style={{ fontSize: 20, color: "#a3a3a3" }}>น้ำดื่มเฉลี่ย/วัน</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: "white" }}>
                {weightDelta !== null ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} กก.` : "—"}
              </span>
              <span style={{ fontSize: 20, color: "#a3a3a3" }}>น้ำหนักเปลี่ยนแปลง</span>
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
      "Cache-Control": "no-cache, no-store",
    },
  });
}
