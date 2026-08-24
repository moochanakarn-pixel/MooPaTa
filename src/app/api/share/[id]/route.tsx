import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { activityTypeLabel, formatDistanceParts, formatDuration, formatPace, formatSpeedKmh } from "@/lib/format";
import { buildRoutePath, extractStravaPolyline, routeGeometryToSvgDataUri } from "@/lib/polyline";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";

// Generates a story-ratio (1080x1920) share card PNG for one activity —
// distance, pace/speed, time, heart rate, and a route sketch — for the user
// to save and post to Instagram/Facebook/Line stories themselves. There's no
// direct "post to story" here: that needs a reviewed Meta/Instagram business
// app integration, well beyond a personal project's scope.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [user, activity] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activity.findUnique({ where: { id: params.id } }),
  ]);
  if (!activity || activity.userId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  const unit = user?.unitSystem ?? "METRIC";
  const isRun = activity.type === "Run";
  const distance = formatDistanceParts(activity.distanceMeters, unit);

  // A malformed/unsupported polyline shouldn't cost the user the whole
  // card — fall back to a routeless layout instead of a 500.
  let routeImg: string | null = null;
  try {
    const polyline = extractStravaPolyline(activity.raw);
    const routeGeo = polyline ? buildRoutePath(polyline, 300, 20) : null;
    routeImg = routeGeo ? routeGeometryToSvgDataUri(routeGeo, "#ffffff") : null;
  } catch (err) {
    console.error("Share card: could not draw route", err);
  }

  const dateLabel = activity.startedAt.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let fonts;
  try {
    fonts = await loadShareFonts();
  } catch (err) {
    // Most likely the bundled .ttf files are missing or corrupted (e.g. a
    // checkout that mangled them). Say so plainly rather than 500-ing.
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
            <span style={{ fontSize: 20, color: "#a3a3a3" }}>{dateLabel}</span>
          </div>
        </div>

        {/* Everything below the header centers together as one block in the
            remaining space, so the composition stays balanced whether or
            not there's a route to draw. */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 28 }}>
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
            {activityTypeLabel(activity.type)}
          </div>

          {activity.name && (
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "white" }}>{activity.name}</div>
          )}

          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 150, fontWeight: 700, color: "white", lineHeight: 1 }}>{distance.value}</span>
            <span style={{ fontSize: 44, fontWeight: 700, color: "#a3a3a3" }}>{distance.unitLabel}</span>
          </div>

          {routeImg && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={routeImg} width={520} height={520} />
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "2px solid rgba(255,255,255,0.12)",
            paddingTop: 36,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: "white" }}>{formatDuration(activity.durationSec)}</span>
            <span style={{ fontSize: 22, color: "#a3a3a3" }}>เวลา</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: "white" }}>
              {isRun ? formatPace(activity.avgSpeedMs, unit) : formatSpeedKmh(activity.avgSpeedMs, unit)}
            </span>
            <span style={{ fontSize: 22, color: "#a3a3a3" }}>{isRun ? "เพซเฉลี่ย" : "ความเร็วเฉลี่ย"}</span>
          </div>
          {activity.avgHeartRate && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: "white" }}>
                {Math.round(activity.avgHeartRate)}
              </span>
              <span style={{ fontSize: 22, color: "#a3a3a3" }}>bpm เฉลี่ย</span>
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
      "Content-Disposition": 'attachment; filename="moopata-activity.png"',
      "Cache-Control": "no-cache, no-store",
    },
  });
}
