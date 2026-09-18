import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { activityTypeLabel, formatDistanceParts, formatDuration, formatElevationM, formatSpeedKmh } from "@/lib/format";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";
import { loadMascotLogoDataUri } from "@/lib/share-logo";
import { cardStyle } from "@/lib/share-card-styles";
import { parseShareLang, shareT } from "@/lib/share-card-i18n";

// Matches src/lib/activity-colors.ts, but as raw hex — satori (the engine
// behind ImageResponse) only understands inline style values, not
// Tailwind classes, so the app's color system has to be duplicated here
// rather than imported.
const TYPE_COLORS: Record<string, string> = {
  Run: "#fc4c02",
  TrailRun: "#fc4c02",
  Ride: "#0ea5e9",
  VirtualRide: "#0ea5e9",
  EBikeRide: "#0ea5e9",
  Walk: "#10b981",
  Hike: "#10b981",
  Swim: "#06b6d4",
  WeightTraining: "#8b5cf6",
  Workout: "#8b5cf6",
  Football: "#a3e635",
  Soccer: "#a3e635",
  Badminton: "#f59e0b",
};
const OTHER_TYPE_COLOR = "#f43f5e";
function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? OTHER_TYPE_COLOR;
}

// "Wrapped"-style summary card for a week or month — same story-ratio PNG
// as the per-activity share card, but totals instead of one activity.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const range = searchParams.get("range") === "week" ? "week" : "month";
  const lang = parseShareLang(searchParams);
  const t = shareT(lang);
  // Same ?bg=transparent option as the activity/daily-summary share cards —
  // see api/share/[id]/route.tsx's fuller comment on why textShadow/badgeBg
  // need to change shape (not just toggle on/off) once the card's own dark
  // backdrop is gone: a single soft shadow only helps against a dark photo,
  // and a 0.15-alpha badge pill reads as a barely-there tint against
  // anything that isn't this card's own background.
  const transparent = searchParams.get("bg") === "transparent";

  const user = await db.user.findUnique({ where: { id: userId } });
  const unit = user?.unitSystem ?? "METRIC";

  const now = new Date();
  let periodStart: Date;
  let periodLabel: string;
  if (range === "week") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() + diffToMonday);
    periodStart.setHours(0, 0, 0, 0);
    periodLabel = t.weekSummaryBadge;
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodLabel = t.monthSummaryBadge;
  }

  const [agg, byType, longest] = await Promise.all([
    db.activity.aggregate({
      where: { userId, startedAt: { gte: periodStart } },
      _count: { _all: true },
      _sum: { distanceMeters: true, durationSec: true, elevationGainM: true },
    }),
    db.activity.groupBy({
      by: ["type"],
      where: { userId, startedAt: { gte: periodStart } },
      _count: { _all: true },
      _sum: { distanceMeters: true },
      orderBy: { _count: { type: "desc" } },
      take: 4,
    }),
    db.activity.findFirst({
      where: { userId, startedAt: { gte: periodStart }, distanceMeters: { not: null } },
      orderBy: { distanceMeters: "desc" },
      select: { name: true, type: true, distanceMeters: true },
    }),
  ]);

  const distance = formatDistanceParts(agg._sum.distanceMeters ?? 0, unit, lang);
  const dateLocale = lang === "en" ? "en-US" : "th-TH";
  const dateRangeLabel = `${periodStart.toLocaleDateString(dateLocale, { day: "numeric", month: "short" })} – ${now.toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}`;

  const totalDistanceM = agg._sum.distanceMeters ?? 0;
  const totalDurationSec = agg._sum.durationSec ?? 0;
  const avgSpeedMs = totalDurationSec > 0 ? totalDistanceM / totalDurationSec : null;
  const totalTypeCount = byType.reduce((sum, t) => sum + t._count._all, 0);

  let fonts;
  let mascotLogo;
  try {
    [fonts, mascotLogo] = await Promise.all([loadShareFonts(), loadMascotLogoDataUri()]);
  } catch (err) {
    console.error("Share card: font/logo load failed", err);
    return new Response(
      `Share card unavailable: could not load fonts (${err instanceof Error ? err.message : String(err)})`,
      { status: 500 }
    );
  }

  // Explicitly "none" rather than undefined — satori crashes if a style
  // object has a textShadow key at all whose value is undefined (see
  // api/share/[id]/route.tsx for the full explanation).
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
          background: transparent ? "transparent" : "linear-gradient(160deg, #0b0f19 0%, #171313 55%, #1c0f08 100%)",
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
            background: badgeBg("252,76,2"),
            color: "#fc4c02",
            fontSize: 26,
            fontWeight: 700,
            textShadow,
          }}
        >
          {periodLabel}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-around", gap: 40, marginTop: 32, marginBottom: 32 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ fontSize: 100, fontWeight: 700, color: "white", lineHeight: 1, textShadow }}>{distance.value}</span>
              <span style={{ fontSize: 34, fontWeight: 700, color: "#a3a3a3", textShadow }}>{distance.unitLabel}</span>
            </div>

            {longest && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
                <span style={{ fontSize: 28 }}>🏆</span>
                {/* Two sibling flex children with a gap, not text + nested span
                    with a trailing space — satori trims whitespace at a text
                    node's boundary with an adjacent element, so a literal
                    space there silently disappears. */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 26, color: "#d4d4d4", textShadow }}>
                    {t.longestPrefix(longest.name ?? activityTypeLabel(longest.type, lang))}
                  </span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: "white", textShadow }}>
                    {formatDistanceParts(longest.distanceMeters, unit, lang).value}{" "}
                    {formatDistanceParts(longest.distanceMeters, unit, lang).unitLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div style={{ display: "flex", gap: 48 }}>
                <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>{agg._count._all}</span>
                  <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.activitiesLabel}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>
                    {formatDuration(agg._sum.durationSec ?? 0, lang)}
                  </span>
                  <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.totalTimeLabel}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 48 }}>
                <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>
                    {formatElevationM(agg._sum.elevationGainM, unit, lang)}
                  </span>
                  <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.totalElevationLabel}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", width: 260 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>{formatSpeedKmh(avgSpeedMs, unit, lang)}</span>
                  <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.avgSpeedLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {byType.length > 0 && totalTypeCount > 0 && (
            <div style={cardStyle}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", height: 20, width: 520, borderRadius: 999, overflow: "hidden" }}>
                  {byType.map((bt) => (
                    <div
                      key={bt.type}
                      style={{
                        display: "flex",
                        width: `${((bt._sum.distanceMeters ?? 0) / (totalDistanceM || 1)) * 100}%`,
                        background: typeColor(bt.type),
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {byType.map((bt) => (
                    <div key={bt.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 520 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ display: "flex", width: 16, height: 16, borderRadius: 999, background: typeColor(bt.type) }} />
                        <span style={{ fontSize: 26, color: "#d4d4d4", textShadow }}>{activityTypeLabel(bt.type, lang)}</span>
                      </div>
                      <span style={{ fontSize: 26, fontWeight: 700, color: "white", textShadow }}>
                        {formatDistanceParts(bt._sum.distanceMeters ?? 0, unit, lang).value}{" "}
                        {formatDistanceParts(bt._sum.distanceMeters ?? 0, unit, lang).unitLabel} · {t.timesSuffix(bt._count._all)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts,
    }
  );

  // ImageResponse streams chunked with no Content-Length, which some
  // browsers' download managers (triggered by the <a download> links on the
  // dashboard) fail outright on with a generic "check your internet
  // connection" — even though the stream itself completed fine (curl gets a
  // valid file). Buffering it and setting Content-Length explicitly gives
  // the download a known size upfront, which is what those managers expect.
  const buffer = await image.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="moopata-${range}-summary.png"`,
      // Short private cache keyed by the full URL (range/bg/lang) — see
      // api/share/[id]/route.tsx's fuller comment on the same header.
      "Cache-Control": "private, max-age=120",
    },
  });
}
