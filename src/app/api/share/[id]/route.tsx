import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
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
// ?pos=top|center|bottom picks where the whole details block (logo, type
// badge, name, hero number, sub-stats/route, stat grid) sits vertically in the
// frame — as one group, not the logo/header separately pinned to the top
// and a stat grid separately pinned to the bottom like before. Combined
// with ?bg=transparent this is what makes the card usable as an
// Instagram/Line-story sticker: pick top or bottom to leave the rest of the
// frame free for the photo underneath to show through. Defaults to
// "center". The logo used to stay pinned top-left regardless of ?pos (on
// the theory that it's just a small brand mark, not part of "the
// details") — changed after user feedback that a centered/bottom-anchored
// card left the logo stranded alone at the top with a large empty gap
// before the rest of the content; it now moves as part of the same group.
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
    // Round total minutes first, then derive h/m from that one integer —
    // rounding them separately let m round up to 60 without carrying into h
    // (same bug class fixed in src/lib/format.ts's formatDuration).
    const totalMin = Math.round(activity.durationSec / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
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

  // style=hero shows at most 4 supporting numbers (2x2) instead of the full
  // grid above — enough to actually say something for a heart-rate-only
  // activity like weight training or badminton (which has no distance/pace/
  // speed/cadence at all, so a plain "first N" slice used to leave only the
  // two HR stats and nothing else), while still staying visibly sparser
  // than the grid layout. Calories is deliberately guaranteed one of those
  // slots whenever present rather than taking whatever falls out of
  // statItems' build order above (distance/pace/speed/elevation/HR/cadence,
  // then calories last) — users specifically want to see it on the hero
  // card, and for a stat-rich activity (e.g. a run with pace + elevation +
  // both HR readings already filling every slot) it would otherwise always
  // lose out to earlier fields no matter how many slots there are.
  const caloriesStat = statItems.find((s) => s.label === t.caloriesLabel);
  const otherStats = statItems.filter((s) => s !== caloriesStat);
  const heroSubStats = caloriesStat ? [...otherStats.slice(0, 3), caloriesStat] : otherStats.slice(0, 4);
  const heroSubStatRows: typeof heroSubStats[] = [];
  for (let i = 0; i < heroSubStats.length; i += 2) heroSubStatRows.push(heroSubStats.slice(i, i + 2));

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
  // (every exercise's every set) can be any length, so the canvas height is
  // computed from the actual content instead of a constant. Each constant
  // below is a rough per-row pixel estimate (font size + line spacing/
  // padding at the sizes used in the JSX further down) rather than an exact
  // measurement — Satori has no layout-measurement API to ask "how tall did
  // this render", so this is the only way to size the canvas before
  // rendering it. A little too tall just leaves harmless blank space at the
  // bottom; a little too short clips content, so every constant here leans
  // generous.
  // 60 was a single-line estimate; bumped for a second-line cushion now
  // that the title can carry "(N ครั้ง)" appended to the exercise name
  // (see uniformReps below) — a long name plus that suffix occasionally
  // wraps, and per the "leans generous" note above, a little unused space
  // is harmless while a clipped card isn't.
  const EXERCISE_TITLE_HEIGHT = 96;
  // Was 50, tuned for the old one-<span>-per-set layout where each line was
  // its own flex row with a `gap: 10` between them. Now that a whole
  // exercise's sets render as one whiteSpace: "pre-line" text node (see the
  // sets JSX below), each line only costs its natural font line-height, no
  // extra flex gap — measured directly (render two real sessions at
  // different set counts, compare each PNG's actual content bounding box
  // via its alpha channel against the canvas height the old constant would
  // allocate) at ~28-31px/line, not 50. Kept at 36 rather than the measured
  // value, same "leans generous" margin the rest of this block already
  // applies elsewhere.
  const SET_ROW_HEIGHT = 36;
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
  //
  // Lowered from 80 to 50 after the first pass: even with the ~2x node-
  // count cut below (single <span> per set), 80 sets still measured
  // ~70-80s worst case — long enough that it was still the dominant
  // contributor to "one big render blocks the whole server" (see the
  // comment above). 50 sets measured ~35-40s in the same environment,
  // roughly halving that worst-case blocking window. Trade-off: a
  // realistically heavy single session (e.g. 12 exercises × 6 sets = 72)
  // can now hit this cap and get truncated where it wouldn't have at 80 —
  // accepted deliberately, since a shorter worst-case freeze for everyone
  // else matters more than never truncating an unusually long session for
  // the one person who logged it (they still get the note + everything up
  // to the cap, not an error).
  const MAX_LIST_SETS = 50;
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

  // List style otherwise showed zero summary numbers at all — no time, no
  // calories, no heart rate, just the exercise breakdown. Weight training
  // always has a duration (unlike distance, which the hero-number fallback
  // logic above deliberately excludes from statItems to avoid showing it
  // twice) — list has no hero number to collide with, so duration is always
  // included here. Calories/avg HR stay optional like everywhere else in
  // this route (skip a field rather than show a meaningless "-"). Kept to
  // exactly these three (not max HR, cadence, elevation, ...) on purpose —
  // this is a one-line summary for a card whose whole point is the exercise
  // list below it, not a second stat grid.
  const listSummaryStats: { value: string; label: string }[] = [{ value: formatDuration(activity.durationSec, lang), label: t.timeLabel }];
  if (activity.calories) listSummaryStats.push({ value: `${Math.round(activity.calories)} kcal`, label: t.caloriesLabel });
  if (activity.avgHeartRate) listSummaryStats.push({ value: `${Math.round(activity.avgHeartRate)} bpm`, label: t.avgHrLabel });

  // The list card shows only the type badge — always exactly one row, so no
  // line-wrap estimate is needed here.
  const listHeaderHeight =
    96 + // mascot logo
    40 + // gap below logo
    46 + // date row
    28 + // gap
    60 + // type badge row
    28 + // gap
    (activity.name ? 50 + 28 : 0) + // activity name + gap, only if present
    72 + // summary stats row (time/calories/avg HR) + gap
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

            {listSummaryStats.length > 0 && (
              <div style={{ display: "flex", gap: 40 }}>
                {listSummaryStats.map((s) => (
                  <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: "white", textShadow }}>{s.value}</span>
                    <span style={{ fontSize: 20, color: "#a3a3a3", textShadow }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "white", textShadow }}>
              {t.exercisesListTitle}
            </div>

            {visibleExercises.length === 0 ? (
              <span style={{ fontSize: 24, color: "#a3a3a3", textShadow }}>{t.noExercisesText}</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: EXERCISE_CARD_GAP }}>
                {visibleExercises.map((ex) => {
                  // Straight sets (same rep count every set — the common
                  // case) used to print "N ครั้ง" on every single line,
                  // which for a 4-set exercise at identical reps/weight/RPE
                  // read as four nearly-identical rows. When every set
                  // shares one rep count, show it once in the exercise
                  // title instead and drop it from each set's line.
                  // Pyramid/drop sets (reps actually differ) keep the full
                  // per-set line so that real variation still shows.
                  const uniformReps =
                    ex.sets.length > 0 && ex.sets.every((s) => s.reps === ex.sets[0].reps) ? ex.sets[0].reps : null;
                  return (
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
                      <span style={{ fontSize: 30, fontWeight: 700, color: "white", textShadow }}>
                        {uniformReps !== null ? t.exerciseNameWithReps(ex.name, uniformReps) : ex.name}
                      </span>
                      {/* All of an exercise's sets as ONE Satori text node
                          (newline-joined + whiteSpace: "pre-line") instead of
                          one <span> per set — Satori renders each `\n` in a
                          pre-line-styled text node as its own line, same
                          visual result as separate spans. This was the
                          largest remaining cost in this render path: a
                          direct before/after timing against this same route
                          (curl, server already warm, same seeded activity)
                          measured a 10-exercise/50-set session (the
                          MAX_LIST_SETS cap) drop from ~35s to ~17s, and an
                          8-exercise/32-set session from ~21s to ~12s — a much
                          bigger win than the earlier 3-nodes-to-1-node-per-set
                          change, because this cuts nodes by the set count
                          instead of by a constant factor. MAX_LIST_SETS is
                          left at 50 rather than raised despite the new
                          headroom — see its own comment for why a short
                          worst-case blocking window matters more than
                          fitting a longer session in one image. */}
                      <span style={{ fontSize: 26, fontWeight: 600, color: "white", textShadow, whiteSpace: "pre-line" }}>
                        {ex.sets
                          .map((s, i) =>
                            uniformReps !== null
                              ? t.setLineNoReps(i + 1, s.weightKg, s.rpe)
                              : t.setLine(i + 1, s.reps, s.weightKg, s.rpe)
                          )
                          .join("\n")}
                      </span>
                    </div>
                  );
                })}
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
        {/* Everything that makes up "the details" — logo, type badge, name,
            hero number, sub-stats/route, and (grid style) the full stat
            grid — moves together as one group, positioned via ?pos instead
            of the old layout where the logo/header sat fixed at the top and
            the stat grid sat fixed at the bottom regardless of how much
            content was in between. Hero style additionally centers
            everything horizontally too, instead of grid's left alignment —
            the one visual choice that does the most to make it read as a
            different, sparser card rather than just "grid with less
            stuff." (Just the mascot mark, no "MooPaTa" wordmark next to
            it — the rest of the details is the whole point of the card,
            the logo is only a small brand corner.) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: POSITION_JUSTIFY[pos],
            alignItems: cardStyle === "hero" ? "center" : "stretch",
            gap: 28,
          }}
        >
          <div style={{ display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mascotLogo} width={96} height={96} style={{ borderRadius: 24 }} />
          </div>

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
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {heroSubStatRows.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 48, justifyContent: "center" }}>
                  {row.map((s) => (
                    <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 220 }}>
                      <span style={{ fontSize: 40, fontWeight: 700, color: "white", textShadow }}>{s.value}</span>
                      <span style={{ fontSize: 25, color: "#a3a3a3", textShadow }}>{s.label}</span>
                    </div>
                  ))}
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
