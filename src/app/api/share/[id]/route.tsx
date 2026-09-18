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
import { parseShareLang, shareT } from "@/lib/share-card-i18n";

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
  const styleParam = searchParams.get("style");
  const cardStyle = styleParam === "hero" ? "hero" : styleParam === "list" ? "list" : "grid";
  const posParam = searchParams.get("pos");
  const pos: Position = (POSITIONS as readonly string[]).includes(posParam ?? "") ? (posParam as Position) : "center";
  const lang = parseShareLang(searchParams);
  const t = shareT(lang);

  const [user, activity] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activity.findUnique({
      where: { id: params.id },
      // Sets are only needed for ?style=list's full breakdown — harmless to
      // always fetch them (a manual activity's exercise list is small)
      // rather than branching the query on `cardStyle` too.
      include: { exercises: { orderBy: { order: "asc" }, include: { sets: { orderBy: { order: "asc" } } } } },
    }),
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
    badges.push(t.longestDistanceBadge);
  }
  if (activity.avgSpeedMs && activity.avgSpeedMs === bests._max.avgSpeedMs) {
    badges.push(activity.type === "Run" || activity.type === "Swim" ? t.fastestPaceBadge : t.fastestSpeedBadge);
  }
  // Weight-training PRs (src/lib/exercise-stats.ts) don't fit the
  // distance/speed badges above at all, but they're exactly the kind of
  // "worth bragging about" moment this card exists for — only queried when
  // the activity actually logged exercises, since most activities won't.
  // Skipped for cardStyle === "list" too: that layout never shows PR
  // badges (see the comment on that div further down — it'd just repeat
  // what the exercise list already shows in full), so this scan of the
  // user's entire exercise history would be pure wasted DB work there.
  if (activity.exercises.length > 0 && cardStyle !== "list") {
    const exerciseStats = await getExerciseStats(userId);
    for (const s of exerciseStats) {
      if (s.prActivityId === activity.id && s.prWeightKg !== null) {
        badges.push(t.prBadge(s.name, s.prWeightKg));
      }
    }
  }

  const unit = user?.unitSystem ?? "METRIC";
  const usesPace = activity.type === "Run" || activity.type === "Swim";
  // The hero number is distance when the activity has one (run/ride/swim/...)
  // — but weight training and similar sessions never do, so showing
  // "0.00 กม." there was actively wrong rather than just sparse. Duration is
  // the one number every activity always has, so it's the universal fallback.
  const distance = activity.distanceMeters ? formatDistanceParts(activity.distanceMeters, unit, lang) : null;
  let heroValue: string;
  let heroUnit: string;
  if (distance) {
    heroValue = distance.value;
    heroUnit = distance.unitLabel;
  } else {
    const h = Math.floor(activity.durationSec / 3600);
    const m = Math.round((activity.durationSec % 3600) / 60);
    heroValue = h > 0 ? `${h}:${String(m).padStart(2, "0")}` : String(m);
    heroUnit = h > 0 ? t.hoursUnit : t.minutesUnit;
  }

  // Everything below the hero number, built as a plain list so a missing
  // field (no distance, no HR sensor, no cadence data, etc.) just drops that
  // one stat instead of leaving a blank/bogus grid cell — duration and
  // pace/speed used to be unconditional here, which meant a weight-training
  // card always showed a meaningless "-" ความเร็วเฉลี่ย row, and duration is
  // skipped when it's already the hero number above instead of repeating it.
  const statItems: { value: string; label: string }[] = [];
  if (distance) {
    statItems.push({ value: formatDuration(activity.durationSec, lang), label: t.timeLabel });
  }
  if (activity.avgSpeedMs) {
    statItems.push({
      value: activitySpeedValue(activity.type, activity.avgSpeedMs, unit, lang),
      label: usesPace ? t.avgPaceLabel : t.avgSpeedLabel,
    });
  }
  if (activity.maxSpeedMs) {
    statItems.push({
      value: activitySpeedValue(activity.type, activity.maxSpeedMs, unit, lang),
      label: usesPace ? t.maxPaceLabel : t.maxSpeedLabel,
    });
  }
  if (activity.elevationGainM) {
    statItems.push({ value: formatElevationM(activity.elevationGainM, unit, lang), label: t.elevationLabel });
  }
  if (activity.avgHeartRate) {
    statItems.push({ value: `${Math.round(activity.avgHeartRate)} bpm`, label: t.avgHrLabel });
  }
  if (activity.maxHeartRate) {
    statItems.push({ value: `${Math.round(activity.maxHeartRate)} bpm`, label: t.maxHrLabel });
  }
  if (activity.avgCadence) {
    statItems.push({ value: `${Math.round(activity.avgCadence)} ${cadenceUnitLabel(activity.type)}`, label: t.avgCadenceLabel });
  }
  if (activity.calories) {
    statItems.push({ value: `${Math.round(activity.calories)} kcal`, label: t.caloriesLabel });
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

  const dateLabel = activity.startedAt.toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {
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
  //
  // A single soft blurred shadow (the original value here) only helps
  // against a *dark* photo — verified by compositing a rendered transparent
  // PNG onto solid white vs. solid black backdrops with Pillow: on black,
  // the light grey/white text reads fine even with no shadow at all; on
  // white, even the 180px bold hero number was nearly invisible, because a
  // wide blur spreads what little dark pixel coverage it has too thin to
  // read as a solid backing. Four tight, barely-blurred offsets in each
  // diagonal direction (a poor-man's text-stroke — satori has no
  // `-webkit-text-stroke` support) plus a wider soft glow on top gives text
  // a near-solid dark outline that stays legible over *any* photo — light,
  // dark, or busy — not just the dark gradient this card normally sits on.
  const textShadow = transparent
    ? "-2px -2px 3px rgba(0,0,0,0.9), 2px -2px 3px rgba(0,0,0,0.9), -2px 2px 3px rgba(0,0,0,0.9), 2px 2px 3px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)"
    : "none";
  // Same reasoning as textShadow above: at their normal 0.15 alpha, the
  // badge pills read as a barely-there tint of whatever's behind them once
  // the card's own dark backdrop is gone — confirmed in the same composited
  // check. Boosting alpha only in transparent mode gives them a proper
  // solid chip appearance regardless of the photo underneath, mirroring the
  // borderTop treatment already applied below for the same reason.
  const badgeBg = (rgb: string) => (transparent ? `rgba(${rgb},0.55)` : `rgba(${rgb},0.15)`);

  // ?style=list has no fixed 1080x1920 aspect like grid/hero — its content
  // (every exercise's every set, plus a PR badge per exercise that hit one)
  // can be any length, so the canvas height is computed from the actual
  // content instead of a constant. Each constant below is a rough per-row
  // pixel estimate (font size + line spacing/padding at the sizes used in
  // the JSX further down) rather than an exact measurement — Satori has no
  // layout-measurement API to ask "how tall did this render", so this is
  // the only way to size the canvas before rendering it. A little too tall
  // just leaves harmless blank space at the bottom; a little too short
  // clips content (confirmed by hand — a session with several PR badges
  // wrapping onto 3 lines lost its whole last exercise card off the bottom
  // edge when this only budgeted one badge row), so every constant here
  // leans generous.
  const EXERCISE_TITLE_HEIGHT = 60;
  const SET_ROW_HEIGHT = 50;
  const EXERCISE_CARD_PADDING = 50; // 24 top + 24 bottom + a few px slack
  const EXERCISE_CARD_GAP = 22;

  // Satori's per-request render time doesn't scale linearly with the
  // number of text nodes on the page — measured directly against this
  // route (seed a MANUAL activity with N sets, curl ?style=list&bg=
  // transparent, time it): 32 sets ≈ 33s, 90 sets ≈ 136s, and a 300-set
  // session pegged one CPU core at ~100% for over 10 minutes without
  // finishing. That's not just "slow for the person who asked for it" —
  // ImageResponse's rendering is synchronous CPU work on Node's single
  // event loop thread, so one oversized render like that stalls every
  // other request the whole server is handling (dashboard loads, other
  // API calls, everyone) for as long as it runs, not only other share-card
  // requests. MAX_LIST_SETS caps the worst case to something that always
  // finishes quickly regardless of how many sets a session actually has —
  // truncating (with a note, never silently) rather than ever feeding an
  // unbounded amount of content into this render path again.
  const MAX_LIST_SETS = 80;
  let listSetsRemaining = MAX_LIST_SETS;
  let omittedSetCount = 0;
  const visibleExercises: { id: string; name: string; sets: (typeof activity.exercises)[number]["sets"] }[] = [];
  for (const ex of activity.exercises) {
    if (listSetsRemaining <= 0) {
      omittedSetCount += ex.sets.length;
      continue;
    }
    const visibleSets = ex.sets.slice(0, listSetsRemaining);
    omittedSetCount += ex.sets.length - visibleSets.length;
    listSetsRemaining -= visibleSets.length;
    if (visibleSets.length > 0) visibleExercises.push({ id: ex.id, name: ex.name, sets: visibleSets });
  }

  const listExercisesHeight =
    visibleExercises.length === 0
      ? 60
      : visibleExercises.reduce(
          (sum, ex) => sum + EXERCISE_TITLE_HEIGHT + ex.sets.length * SET_ROW_HEIGHT + EXERCISE_CARD_PADDING + EXERCISE_CARD_GAP,
          0
        ) + (omittedSetCount > 0 ? 44 : 0); // truncation note line

  // Unlike grid/hero, the list card shows only the type badge, never the PR
  // badges (see the comment on that div further down) — always exactly one
  // row, so no line-wrap estimate is needed here the way there briefly was
  // when PR badges were still shown (that's what caused the clipping this
  // whole height-estimation approach exists to avoid).
  const listHeaderHeight =
    96 + // mascot logo
    40 + // gap below logo
    46 + // date row
    28 + // gap
    60 + // type badge row
    28 + // gap
    (activity.name ? 50 + 28 : 0) + // activity name + gap, only if present
    58; // "ท่าออกกำลังกาย" section title + gap
  const listHeight = Math.round(2 * 64 + listHeaderHeight + listExercisesHeight + 40); // + flat safety margin

  let image: InstanceType<typeof ImageResponse>;
  if (cardStyle === "list") {
    image = new ImageResponse(
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
          <div style={{ display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mascotLogo} width={96} height={96} style={{ borderRadius: 24 }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 28 }}>
            <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{dateLabel}</span>

            {/* No PR badges here (unlike grid/hero below) — a PR badge's
                text ("PR Reverse pecfly 12 กก.") is just that exercise's own
                name + weight, which the full exercise list right below
                already shows in detail — repeating it up here as a row of
                badges was pure duplication for a card whose whole point is
                the exercise list itself, per user request. */}
            <div style={{ display: "flex" }}>
              <div
                style={{
                  display: "flex",
                  padding: "10px 24px",
                  borderRadius: 999,
                  background: badgeBg("252,76,2"),
                  color: "#fc4c02",
                  fontSize: 26,
                  fontWeight: 700,
                  textShadow,
                }}
              >
                {activityTypeLabel(activity.type, lang)}
              </div>
            </div>

            {activity.name && (
              <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "white", textShadow }}>
                {activity.name}
              </div>
            )}

            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "white", textShadow }}>
              {t.exercisesListTitle}
            </div>

            {visibleExercises.length === 0 ? (
              <span style={{ fontSize: 24, color: "#a3a3a3", textShadow }}>{t.noExercisesText}</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: EXERCISE_CARD_GAP }}>
                {visibleExercises.map((ex) => (
                  <div
                    key={ex.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      borderRadius: 20,
                      border: "2px solid rgba(255,255,255,0.14)",
                      padding: 24,
                    }}
                  >
                    <span style={{ fontSize: 30, fontWeight: 700, color: "white", textShadow }}>{ex.name}</span>
                    {/* One combined span per set instead of a row div + two
                        separate spans (label, detail) — three Satori text/
                        layout nodes down to one. A long session's sheer set
                        count is what made this render path slow (see the
                        perf comment above MAX_LIST_SETS), so cutting nodes
                        here matters more than for any other card style. */}
                    {ex.sets.map((s, i) => (
                      <span key={s.id} style={{ fontSize: 26, fontWeight: 600, color: "white", textShadow }}>
                        {t.setLine(i + 1, s.reps, s.weightKg, s.rpe)}
                      </span>
                    ))}
                  </div>
                ))}
                {omittedSetCount > 0 && (
                  <span style={{ fontSize: 22, color: "#a3a3a3", textShadow }}>{t.listTruncatedNote(omittedSetCount)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ),
      { width: 1080, height: listHeight, fonts }
    );
  } else {
    image = new ImageResponse(
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
                background: badgeBg("252,76,2"),
                color: "#fc4c02",
                fontSize: 26,
                fontWeight: 700,
                textShadow,
              }}
            >
              {activityTypeLabel(activity.type, lang)}
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
                  background: badgeBg("245,158,11"),
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
  }

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
      // The URL already fully encodes everything that affects the image
      // (activity id + style/bg/pos/lang), so re-requesting the exact same
      // combo — e.g. toggling back to a style already previewed in the
      // sheet — can safely reuse the browser's own copy instead of
      // re-rendering through Satori again, which was the slow part of the
      // preview. `private` (never a shared/CDN cache, this is
      // session-gated) + a short max-age caps how stale a cached preview
      // can get if the activity is edited/deleted moments after generating
      // one — low-risk since that's a narrow window to hit in practice.
      "Cache-Control": "private, max-age=120",
    },
  });
}
