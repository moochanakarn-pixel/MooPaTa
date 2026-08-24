import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { activityTypeLabel, formatDistanceParts, formatDuration } from "@/lib/format";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";

// "Wrapped"-style summary card for a week or month — same story-ratio PNG
// as the per-activity share card, but totals instead of one activity.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const range = req.nextUrl.searchParams.get("range") === "week" ? "week" : "month";

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
    periodLabel = "สรุปสัปดาห์นี้";
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodLabel = "สรุปเดือนนี้";
  }

  const [agg, byType] = await Promise.all([
    db.activity.aggregate({
      where: { userId, startedAt: { gte: periodStart } },
      _count: { _all: true },
      _sum: { distanceMeters: true, durationSec: true, elevationGainM: true },
    }),
    db.activity.groupBy({
      by: ["type"],
      where: { userId, startedAt: { gte: periodStart } },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
      take: 4,
    }),
  ]);

  const distance = formatDistanceParts(agg._sum.distanceMeters ?? 0, unit);
  const dateRangeLabel = `${periodStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} – ${now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`;

  let fonts;
  try {
    fonts = await loadShareFonts();
  } catch (err) {
    console.error("Share card: font load failed", err);
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
          background: "linear-gradient(160deg, #0b0f19 0%, #171313 55%, #1c0f08 100%)",
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
              background: "rgba(252,76,2,0.15)",
              color: "#fc4c02",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {periodLabel}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 150, fontWeight: 700, color: "white", lineHeight: 1 }}>{distance.value}</span>
            <span style={{ fontSize: 44, fontWeight: 700, color: "#a3a3a3" }}>{distance.unitLabel}</span>
          </div>

          <div style={{ display: "flex", gap: 48 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: "white" }}>{agg._count._all}</span>
              <span style={{ fontSize: 22, color: "#a3a3a3" }}>กิจกรรม</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: "white" }}>
                {formatDuration(agg._sum.durationSec ?? 0)}
              </span>
              <span style={{ fontSize: 22, color: "#a3a3a3" }}>เวลารวม</span>
            </div>
          </div>

          {byType.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {byType.map((t) => (
                <div key={t.type} style={{ display: "flex", justifyContent: "space-between", width: 480 }}>
                  <span style={{ fontSize: 26, color: "#d4d4d4" }}>{activityTypeLabel(t.type)}</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: "white" }}>{t._count._all} ครั้ง</span>
                </div>
              ))}
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
      "Cache-Control": "no-cache, no-store",
    },
  });
}
