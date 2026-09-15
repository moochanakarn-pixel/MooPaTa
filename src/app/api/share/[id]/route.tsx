import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getExerciseStats } from "@/lib/exercise-stats";
import {
  activitySpeedValue,
  activityTypeLabel,
  cadenceUnitLabel,
  formatDistanceParts,
  formatDuration,
  formatElevationM,
} from "@/lib/format";
import { buildRoutePath, extractStravaPolyline, routeGeometryToSvgDataUri } from "@/lib/polyline";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";
import { loadMascotLogoDataUri } from "@/lib/share-logo";

// Generates a story-ratio (1080x1920) share card PNG for one activity —
// distance, pace/speed, time, heart rate, and a route sketch — for the user
// to save and post to Instagram/Facebook/Line stories themselves. There's no
// direct "post to story" here: that needs a reviewed Meta/Instagram business
// app integration, well beyond a personal project's scope.
//
// ?bg=transparent drops the gradient background entirely (next/og's PNG
// output supports alpha natively — nothing extra needed) so the card can be
// dropped onto an Instagram/Line story over a photo instead of always
// carrying its own backdrop, mirroring what Strava's own share sheet offers.
//
// ?style=hero switches from the default "grid" layout (full stat grid +
// route sketch, left-aligned) to a minimal, centered card with just the hero
// number and at most two supporting stats — no grid, no route. Two very
// different use cases: grid for a detailed record of the activity, hero for
// a quick centered flex that reads at a glance (closer to what most people
// actually post to a story).
//
// ?pos=top|center|bottom picks where the whole details block (badges, name,
// hero number, sub-stats/route, stat grid) sits vertically in the frame —
// as one group, not the header separately pinned to the top and a stat grid
// separately pinned to the bottom like before. Combined with ?bg=transparent
// this is what makes the card usable as an Instagram/Line-story sticker:
// pick top or bottom to leave the rest of the frame free for the photo
// underneath to show through. Defaults to "center". The header logo itself
// always stays pinned top-left regardless of this — it's a small brand mark,
// not part of "the details."
const POSITIONS = ["top", "center", "bottom"] as const;
type Position = (typeof POSITIONS)[number];
const POSITION_JUSTIFY: Record<Position, string> = { top: "flex-start", center: "center", bottom: "flex-end" };

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = new URL(req.url).searchParams;
  const transparent = searchParams.get("bg") === "transparent";
  const cardStyle = searchParams.get("style") === "hero" ? "hero" : "grid";
  const posParam = searchParams.get("pos");
  const pos: Position = (POSITIONS as readonly string[]).includes(posParam ?? "") ? (posParam as Position) : "center";

  const [user, activity] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activity.findUnique({ where: { id: params.id }, include: { exercises: true } }),
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
    badges.push(activity.type === "Run" || activity.type === "Swim" ? "เพซเร็วที่สุด" : "ความเร็วสูงสุด");
  }
  // Weight-training PRs (src/lib/exercise-stats.ts) don't fit the
  // distance/speed badges above at all, but they're exactly the kind of
  // "worth bragging about" moment this card exists for — only queried when
  // the activity actually logged exercises, since most activities won't.
  if (activity.exercises.length > 0) {
    const exerciseStats = await getExerciseStats(userId);
    for (const s of exerciseStats) {
      if (s.prActivityId === activity.id && s.prWeightKg !== null) {
        badges.push(`PR ${s.name} ${s.prWeightKg} กก.`);
      }
    }
  }

  const unit = user?.unitSystem ?? "METRIC";
  const usesPace = activity.type === "Run" || activity.type === "Swim";
  // The hero number is distance when the activity has one (run/ride/swim/...)
  // — but weight training and similar sessions never do, so showing
  // "0.00 กม." there was actively wrong rather than just sparse. Duration is
  // the one number every activity always has, so it's the universal fallback.
  const distance = activity.distanceMeters ? formatDistanceParts(activity.distanceMeters, unit) : null;
  let heroValue: string;
  let heroUnit: string;
  if (distance) {
    heroValue = distance.value;
    heroUnit = distance.unitLabel;
  } else {
    const h = Math.floor(activity.durationSec / 3600);
    const m = Math.round((activity.durationSec % 3600) / 60);
    heroValue = h > 0 ? `${h}:${String(m).padStart(2, "0")}` : String(m);
    heroUnit = h > 0 ? "ชม." : "นาที";
  }

  // Everything below the hero number, built as a plain list so a missing
  // field (no distance, no HR sensor, no cadence data, etc.) just drops that
  // one stat instead of leaving a blank/bogus grid cell — duration and
  // pace/speed used to be unconditional here, which meant a weight-training
  // card always showed a meaningless "-" ความเร็วเฉลี่ย row, and duration is
  // skipped when it's already the hero number above instead of repeating it.
  const statItems: { value: string; label: string }[] = [];
  if (distance) {
    statItems.push({ value: formatDuration(activity.durationSec), label: "เวลา" });
  }
  if (activity.avgSpeedMs) {
    statItems.push({
      value: activitySpeedValue(activity.type, activity.avgSpeedMs, unit),
      label: usesPace ? "เพซเฉลี่ย" : "ความเร็วเฉลี่ย",
    });
  }
  if (activity.maxSpeedMs) {
    statItems.push({
      value: activitySpeedValue(activity.type, activity.maxSpeedMs, unit),
      label: usesPace ? "เพซสูงสุด" : "ความเร็วสูงสุด",
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
    statItems.push({ value: `${Math.round(activity.avgCadence)} ${cadenceUnitLabel(activity.type)}`, label: "เคเดนซ์เฉลี่ย" });
  }
  if (activity.calories) {
    statItems.push({ value: `${Math.round(activity.calories)} kcal`, label: "แคลอรี่" });
  }
  const statRows: { value: string; label: string }[][] = [];
  for (let i = 0; i < statItems.length; i += 3) statRows.push(statItems.slice(i, i + 3));

  // style=hero shows at most 2 supporting numbers instead of the full grid
  // above — just whichever second/third numbers matter most next to the
  // hero, so the card stays glanceable instead of turning into a smaller
  // version of the grid layout.
  const heroSubStats = statItems.slice(0, 2);

  // A malformed/unsupported polyline shouldn't cost the user the whole
  // card — fall back to a routeless layout instead of a 500.
  let routeImg: string | null = null;
  try {
    const polyline = extractStravaPolyline(activity.raw);
    const routeGeo = polyline ? buildRoutePath(polyline, 300, 20, unit) : null;
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
  let mascotLogo: string;
  try {
    [fonts, mascotLogo] = await Promise.all([loadShareFonts(), loadMascotLogoDataUri()]);
  } catch (err) {
    // Most likely the bundled .ttf/.png files are missing or corrupted
    // (e.g. a checkout that mangled them). Say so plainly rather than 500-ing.
    console.error("Share card: asset load failed", err);
    return new Response(
      `Share card unavailable: could not load fonts/logo (${err instanceof Error ? err.message : String(err)})`,
      { status: 500 }
    );
  }

  // Transparent mode drops the card's own backdrop, so every text element
  // needs its own shadow to stay legible over whatever photo it ends up on
  // — pointless (and a visual downgrade) against the card's already-dark
  // background, so only applied when there's no background to rely on.
  // Explicitly "none" rather than leaving it undefined — satori's style
  // parser chokes (crashes rendering with an unrelated-looking "Cannot read
  // properties of undefined" deep inside @vercel/og) on a style object that
  // has a `textShadow` key present at all whose value is `undefined`.
  const textShadow = transparent ? "0 2px 10px rgba(0,0,0,0.85)" : "none";

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
        {/* Just the mascot mark, no "MooPaTa" wordmark next to it — the
            details block below (badges/name/numbers/stat grid) is the whole
            point of the card, this is only a small brand corner. Stays
            pinned top-left regardless of ?pos: it's not part of "the
            details" whose position is selectable. */}
        <div style={{ display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mascotLogo} width={96} height={96} style={{ borderRadius: 24 }} />
        </div>

        {/* Everything that makes up "the details" — badges, name, hero
            number, sub-stats/route, and (grid style) the full stat grid —
            now moves together as one group, positioned via ?pos instead of
            the old layout where the header sat fixed at the top and the
            stat grid sat fixed at the bottom regardless of how much content
            was in between. Hero style additionally centers everything
            horizontally too, instead of grid's left alignment — the one
            visual choice that does the most to make it read as a different,
            sparser card rather than just "grid with less stuff." */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: POSITION_JUSTIFY[pos],
            alignItems: cardStyle === "hero" ? "center" : "stretch",
            gap: 28,
            marginTop: 40,
          }}
        >
          <span style={{ fontSize: 22, color: "#a3a3a3", textShadow, textAlign: cardStyle === "hero" ? "center" : "left" }}>
            {dateLabel}
          </span>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: cardStyle === "hero" ? "center" : "flex-start" }}>
            <div
              style={{
                display: "flex",
                padding: "10px 24px",
                borderRadius: 999,
                background: "rgba(252,76,2,0.15)",
                color: "#fc4c02",
                fontSize: 26,
                fontWeight: 700,
                textShadow,
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
                  textShadow,
                }}
              >
                🏆 {b}
              </div>
            ))}
          </div>

          {activity.name && (
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "white", textShadow }}>
              {activity.name}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span
              style={{
                fontSize: cardStyle === "hero" ? 180 : 150,
                fontWeight: 700,
                color: "white",
                lineHeight: 1,
                textShadow,
              }}
            >
              {heroValue}
            </span>
            <span style={{ fontSize: 44, fontWeight: 700, color: "#a3a3a3", textShadow }}>{heroUnit}</span>
          </div>

          {cardStyle === "hero" && heroSubStats.length > 0 && (
            <div style={{ display: "flex", gap: 48, justifyContent: "center" }}>
              {heroSubStats.map((s) => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>{s.value}</span>
                  <span style={{ fontSize: 25, color: "#a3a3a3", textShadow }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {cardStyle === "grid" && routeImg && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={routeImg} width={520} height={520} />
            </div>
          )}

          {/* Part of the same group now instead of a separate flex:1
              sibling pinned to the physical bottom of the frame — moves
              together with everything above when ?pos changes. */}
          {cardStyle === "grid" && statItems.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 22,
                borderTop: `2px solid ${transparent ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)"}`,
                paddingTop: 32,
                marginTop: 12,
              }}
            >
              {statRows.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 32 }}>
                  {row.map((s) => (
                    <div key={s.label} style={{ display: "flex", flexDirection: "column", width: 288 }}>
                      <span style={{ fontSize: 36, fontWeight: 700, color: "white", textShadow }}>{s.value}</span>
                      <span style={{ fontSize: 25, color: "#a3a3a3", textShadow }}>{s.label}</span>
                    </div>
                  ))}
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
      "Content-Disposition": 'attachment; filename="moopata-activity.png"',
      "Cache-Control": "no-cache, no-store",
    },
  });
}
