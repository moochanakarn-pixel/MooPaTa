import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { activityTypeLabel, formatDistanceParts, formatDuration } from "@/lib/format";
import { localDateKey } from "@/lib/streak";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";
import { loadMascotLogoDataUri } from "@/lib/share-logo";
import { cardStyle } from "@/lib/share-card-styles";
import { parseShareLang, shareT } from "@/lib/share-card-i18n";

// "Wrapped"-style highlight-reel card, distinct from /api/share/period's
// plain totals: period answers "how much did I do", this one answers "what
// am I proud of" — a PR hit this period, the sport trained most, a food-
// logging streak — reusing the same story-ratio PNG shell (fonts, mascot,
// gradient/textShadow/badgeBg handling) as every other card in this family.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") === "year" ? "year" : "month";
  const lang = parseShareLang(searchParams);
  const t = shareT(lang);
  const transparent = searchParams.get("bg") === "transparent";

  const user = await db.user.findUnique({ where: { id: userId } });
  const unit = user?.unitSystem ?? "METRIC";

  const now = new Date();
  const dateLocale = lang === "en" ? "en-US" : "th-TH";
  let periodStart: Date;
  let periodLabel: string;
  let daysInPeriodSoFar: number;
  if (period === "year") {
    periodStart = new Date(now.getFullYear(), 0, 1);
    periodLabel = now.toLocaleDateString(dateLocale, { year: "numeric" });
    daysInPeriodSoFar = Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1;
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodLabel = now.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });
    daysInPeriodSoFar = now.getDate();
  }

  const [agg, byType, bestSet, volumeSets, foodLogs] = await Promise.all([
    db.activity.aggregate({
      where: { userId, startedAt: { gte: periodStart } },
      _count: { _all: true },
      _sum: { durationSec: true, distanceMeters: true },
    }),
    db.activity.groupBy({
      by: ["type"],
      where: { userId, startedAt: { gte: periodStart } },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
      take: 1,
    }),
    // The single heaviest set logged this period, across any exercise —
    // "PR" here means "the best thing you lifted this period", not
    // necessarily an all-time record (that's exercise-stats.ts's job,
    // scoped per exercise name over all history — a different question).
    db.exerciseSet.findFirst({
      where: { weightKg: { not: null }, exercise: { activity: { userId, startedAt: { gte: periodStart } } } },
      orderBy: { weightKg: "desc" },
      include: { exercise: { select: { name: true } } },
    }),
    // Total weight × reps this period. Fetched as rows and reduced in JS
    // rather than a Prisma aggregate, since `_sum` can't express a
    // computed weightKg*reps product — fine at this app's personal scale.
    db.exerciseSet.findMany({
      where: { weightKg: { not: null }, exercise: { activity: { userId, startedAt: { gte: periodStart } } } },
      select: { weightKg: true, reps: true },
    }),
    db.foodLog.findMany({ where: { userId, loggedAt: { gte: periodStart } }, select: { loggedAt: true } }),
  ]);

  const totalVolumeKg = volumeSets.reduce((sum, s) => sum + (s.weightKg ?? 0) * s.reps, 0);
  const foodLoggedDays = new Set(foodLogs.map((f) => localDateKey(f.loggedAt))).size;
  const favoriteType = byType[0] && byType[0]._count._all > 0 ? byType[0] : null;
  const totalDistanceM = agg._sum.distanceMeters ?? 0;
  const distance = formatDistanceParts(totalDistanceM, unit, lang);
  const numberLocale = lang === "en" ? "en-US" : "th-TH";
  const hasAnyData = agg._count._all > 0 || totalVolumeKg > 0 || foodLoggedDays > 0;

  let fonts;
  let mascotLogo: string;
  try {
    [fonts, mascotLogo] = await Promise.all([loadShareFonts(), loadMascotLogoDataUri()]);
  } catch (err) {
    console.error("Share card: font/logo load failed", err);
    return new Response(
      `Share card unavailable: could not load fonts (${err instanceof Error ? err.message : String(err)})`,
      { status: 500 }
    );
  }

  // Same textShadow/badgeBg treatment as every other card in this family —
  // see api/share/[id]/route.tsx for the full explanation of why
  // transparent mode needs a multi-layer shadow (not just a toggle) and why
  // `undefined` here crashes satori.
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
          background: transparent ? "transparent" : "linear-gradient(160deg, #1a0b2e 0%, #150f2e 45%, #0b0f19 100%)",
          padding: 64,
          fontFamily: "Noto Sans Thai",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mascotLogo} width={56} height={56} style={{ borderRadius: 14 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "white", textShadow }}>MooPaTa</span>
            <span style={{ fontSize: 20, color: "#a3a3a3", textShadow }}>{periodLabel}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            marginTop: 28,
            padding: "10px 24px",
            borderRadius: 999,
            background: badgeBg("245,158,11"),
            color: "#f59e0b",
            fontSize: 26,
            fontWeight: 700,
            textShadow,
          }}
        >
          {t.recapBadge}
        </div>

        {!hasAnyData ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
            <div style={{ ...cardStyle, display: "flex", textAlign: "center" }}>
              <span style={{ fontSize: 28, color: "#d4d4d4", textShadow }}>{t.recapEmptyText}</span>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "space-around",
              gap: 32,
              marginTop: 32,
              marginBottom: 32,
            }}
          >
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontSize: 100, fontWeight: 700, color: "white", lineHeight: 1, textShadow }}>
                  {agg._count._all}
                </span>
                <span style={{ fontSize: 34, fontWeight: 700, color: "#a3a3a3", textShadow }}>{t.activitiesLabel}</span>
              </div>
              <div style={{ display: "flex", gap: 48, marginTop: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>
                    {formatDuration(agg._sum.durationSec ?? 0, lang)}
                  </span>
                  <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.totalTimeLabel}</span>
                </div>
                {totalDistanceM > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                    <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>
                      {distance.value} {distance.unitLabel}
                    </span>
                    <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.totalDistanceLabel}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", gap: 48 }}>
                {totalVolumeKg > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                    <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>
                      {t.kgValue(Math.round(totalVolumeKg).toLocaleString(numberLocale))}
                    </span>
                    <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.totalVolumeLabel}</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>
                    {t.daysOfLabel(foodLoggedDays, daysInPeriodSoFar)}
                  </span>
                  <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.foodLoggedLabel}</span>
                </div>
              </div>
            </div>

            {bestSet && bestSet.weightKg !== null && (
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <span style={{ fontSize: 40 }}>🏆</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: "white", textShadow }}>
                      {t.prBadge(bestSet.exercise.name, bestSet.weightKg)}
                    </span>
                    <span style={{ fontSize: 20, color: "#a3a3a3", textShadow }}>{t.newPrHighlightLabel}</span>
                  </div>
                </div>
              </div>
            )}

            {favoriteType && (
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <span style={{ fontSize: 40 }}>⭐</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: "white", textShadow }}>
                      {activityTypeLabel(favoriteType.type, lang)} · {t.timesSuffix(favoriteType._count._all)}
                    </span>
                    <span style={{ fontSize: 20, color: "#a3a3a3", textShadow }}>{t.favoriteTypeLabel}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts,
    }
  );

  // Buffered with an explicit Content-Length — see api/share/[id]/route.tsx's
  // fuller comment on why some browsers' download managers choke on
  // ImageResponse's chunked stream otherwise.
  const buffer = await image.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="moopata-recap-${period}.png"`,
      // Short private cache keyed by the full URL (period/bg/lang) — see
      // api/share/[id]/route.tsx's fuller comment on the same header.
      "Cache-Control": "private, max-age=120",
    },
  });
}
