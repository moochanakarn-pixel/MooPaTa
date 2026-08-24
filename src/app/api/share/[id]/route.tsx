import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import {
  activityTypeLabel,
  formatDistanceParts,
  formatDuration,
  formatElevationM,
  formatPace,
  formatSpeedKmh,
} from "@/lib/format";
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

  const bests = await db.activity.aggregate({
    where: { userId, type: activity.type },
    _max: { distanceMeters: true, avgSpeedMs: true },
  });
  const badges: string[] = [];
  if (activity.distanceMeters && activity.distanceMeters === bests._max.distanceMeters) {
    badges.push("ระยะทางไกลที่สุด");
  }
  if (activity.avgSpeedMs && activity.avgSpeedMs === bests._max.avgSpeedMs) {
    badges.push("เพซเร็วที่สุด");
  }

  const unit = user?.unitSystem ?? "METRIC";
  const isRun = activity.type === "Run";
  const distance = formatDistanceParts(activity.distanceMeters, unit);

  // Everything below the hero distance number, built as a plain list so a
  // missing field (no HR sensor, no cadence data, etc.) just drops that one
  // stat instead of leaving a blank grid cell.
  const statItems: { value: string; label: string }[] = [
    { value: formatDuration(activity.durationSec), label: "เวลา" },
    {
      value: isRun ? formatPace(activity.avgSpeedMs, unit) : formatSpeedKmh(activity.avgSpeedMs, unit),
      label: isRun ? "เพซเฉลี่ย" : "ความเร็วเฉลี่ย",
    },
  ];
  if (activity.maxSpeedMs) {
    statItems.push({
      value: isRun ? formatPace(activity.maxSpeedMs, unit) : formatSpeedKmh(activity.maxSpeedMs, unit),
      label: isRun ? "เพซสูงสุด" : "ความเร็วสูงสุด",
    });
  }
  if (activity.elevationGainM) {
    statItems.push({ value: formatElevationM(activity.elevationGainM, unit), label: "ไต่ระดับ" });
  }
  if (activity.avgHeartRate) {
    statItems.push({ value: `${Math.round(activity.avgHeartRate)} bpm`, label: "หัวใจเฉลี่ย" });
  }
  if (activity.maxHeartRate) {
    statItems.push({ value: `${Math.round(activity.maxHeartRate)} bpm`, label: "หัวใจสูงสุด" });
  }
  if (activity.avgCadence) {
    statItems.push({ value: `${Math.round(activity.avgCadence)} rpm`, label: "เคเดนซ์เฉลี่ย" });
  }
  if (activity.calories) {
    statItems.push({ value: `${Math.round(activity.calories)} kcal`, label: "แคลอรี่" });
  }
  const statRows: { value: string; label: string }[][] = [];
  for (let i = 0; i < statItems.length; i += 3) statRows.push(statItems.slice(i, i + 3));

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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div
              style={{
                display: "flex",
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
            {badges.map((b) => (
              <div
                key={b}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "rgba(245,158,11,0.15)",
                  color: "#f59e0b",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                🏆 {b}
              </div>
            ))}
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
            flexDirection: "column",
            gap: 22,
            borderTop: "2px solid rgba(255,255,255,0.12)",
            paddingTop: 32,
          }}
        >
          {statRows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 32 }}>
              {row.map((s) => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", width: 288 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: "white" }}>{s.value}</span>
                  <span style={{ fontSize: 20, color: "#a3a3a3" }}>{s.label}</span>
                </div>
              ))}
            </div>
          ))}
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
