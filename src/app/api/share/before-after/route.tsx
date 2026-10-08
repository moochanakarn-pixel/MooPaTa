import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PHOTO_ANGLES, type PhotoAngle } from "@/lib/progress-photo-types";
import { contentTypeForPath, readProgressPhotoFile } from "@/lib/progress-photo-storage";
import { getSessionUserId } from "@/lib/session";
import { loadShareFonts } from "@/lib/share-fonts";
import { loadMascotLogoDataUri } from "@/lib/share-logo";
import { cardStyle } from "@/lib/share-card-styles";
import { parseShareLang, shareT } from "@/lib/share-card-i18n";

// Downloadable version of ProgressPhotosCard's in-app before/after
// comparison (src/app/dashboard/nutrition/progress-photos-card.tsx) — that
// comparison has existed for a while but was never exportable as an image
// of its own, unlike every other stat in the app. Same story-ratio PNG
// shell as the other share cards, but the "hero" content here is the two
// actual photos rather than a number.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const angleParam = searchParams.get("angle");
  const angle: PhotoAngle = (PHOTO_ANGLES as readonly string[]).includes(angleParam ?? "") ? (angleParam as PhotoAngle) : "FRONT";
  const lang = parseShareLang(searchParams);
  const t = shareT(lang);
  const transparent = searchParams.get("bg") === "transparent";
  const hideLogo = searchParams.get("logo") === "hide";
  const angleLabel = angle === "FRONT" ? t.angleFrontLabel : angle === "SIDE" ? t.angleSideLabel : t.angleBackLabel;

  const entries = await db.progressPhotoLog.findMany({
    where: { userId, angle },
    orderBy: { takenAt: "asc" },
  });
  const oldest = entries[0] ?? null;
  const latest = entries[entries.length - 1] ?? null;
  // Same entry twice (photo count === 1) isn't a real comparison — the UI
  // only ever shows the before/after section once an angle has ≥2 photos
  // (ProgressPhotosCard's anglesWithComparison), so this route matches that
  // bar rather than rendering a "before vs. itself" card for a direct hit.
  const hasComparison = oldest !== null && latest !== null && oldest.id !== latest.id;

  let fonts;
  let mascotLogo = "";
  try {
    if (hideLogo) {
      fonts = await loadShareFonts();
    } else {
      [fonts, mascotLogo] = await Promise.all([loadShareFonts(), loadMascotLogoDataUri()]);
    }
  } catch (err) {
    console.error("Share card: font/logo load failed", err);
    return new Response(
      `Share card unavailable: could not load fonts (${err instanceof Error ? err.message : String(err)})`,
      { status: 500 }
    );
  }

  // The photo files live outside public/, readable only through the
  // auth-gated /api/progress-photo/[id] route — satori has no session
  // cookie to fetch that URL with, so (same as User.avatarPath in
  // daily-summary/route.tsx) the raw bytes are read straight off disk here
  // and embedded as data URIs instead.
  let beforePhoto: string | null = null;
  let afterPhoto: string | null = null;
  if (hasComparison && oldest && latest) {
    const [beforeBuf, afterBuf] = await Promise.all([
      readProgressPhotoFile(oldest.photoPath),
      readProgressPhotoFile(latest.photoPath),
    ]);
    if (beforeBuf && afterBuf) {
      beforePhoto = `data:${contentTypeForPath(oldest.photoPath)};base64,${beforeBuf.toString("base64")}`;
      afterPhoto = `data:${contentTypeForPath(latest.photoPath)};base64,${afterBuf.toString("base64")}`;
    }
  }
  // A missing file on disk (deleted out from under the DB row somehow)
  // degrades to the same empty state as "not enough photos" rather than a
  // 500 — nothing left worth building a comparison card out of either way.
  const canRender = beforePhoto !== null && afterPhoto !== null;

  const dateLocale = lang === "en" ? "en-US" : "th-TH";
  const formatDate = (d: Date) => d.toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });
  const daysApart = canRender && oldest && latest ? Math.round((latest.takenAt.getTime() - oldest.takenAt.getTime()) / 86_400_000) : 0;

  const textShadow = transparent
    ? "-2px -2px 3px rgba(0,0,0,0.9), 2px -2px 3px rgba(0,0,0,0.9), -2px 2px 3px rgba(0,0,0,0.9), 2px 2px 3px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)"
    : "none";
  const badgeBg = (rgb: string) => (transparent ? `rgba(${rgb},0.55)` : `rgba(${rgb},0.15)`);
  // Width is the binding constraint (two boxes + a gap have to fit the
  // 1080px canvas minus padding), so it stays close to the in-app
  // thumbnails' 3:4 aspect. Height has much more room to spare — a first
  // pass at matching that 3:4 ratio (613px tall) left roughly half the
  // 1920px canvas empty above and below the photos, which undersells the
  // one thing this card actually exists to show off. object-fit: cover
  // handles the taller box the same way it already handles any source
  // photo whose own aspect ratio doesn't match — crop, don't distort — so
  // there's no correctness reason to keep matching 3:4 here.
  const PHOTO_WIDTH = 460;
  const PHOTO_HEIGHT = 940;

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
          {!hideLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mascotLogo} width={56} height={56} style={{ borderRadius: 14 }} />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "white", textShadow }}>MooPaTa</span>
            <span style={{ fontSize: 20, color: "#a3a3a3", textShadow }}>{angleLabel}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            marginTop: 28,
            padding: "10px 24px",
            borderRadius: 999,
            background: badgeBg("6,182,212"),
            color: "#22d3ee",
            fontSize: 26,
            fontWeight: 700,
            textShadow,
          }}
        >
          {t.beforeAfterBadge}
        </div>

        {!canRender ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
            <div style={{ ...cardStyle, display: "flex", textAlign: "center" }}>
              <span style={{ fontSize: 28, color: "#d4d4d4", textShadow }}>{t.beforeAfterEmptyText}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 28, marginTop: 32 }}>
            <span style={{ display: "flex", alignSelf: "center", fontSize: 24, color: "#a3a3a3", textShadow }}>
              {t.daysApartLabel(daysApart)}
            </span>

            <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", width: PHOTO_WIDTH }}>
                <div style={{ display: "flex", width: PHOTO_WIDTH, height: PHOTO_HEIGHT, borderRadius: 28, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={beforePhoto!} width={PHOTO_WIDTH} height={PHOTO_HEIGHT} style={{ objectFit: "cover" }} />
                </div>
                <span style={{ display: "flex", justifyContent: "center", marginTop: 14, fontSize: 24, fontWeight: 700, color: "white", textShadow }}>
                  {t.beforeLabel}
                </span>
                <span style={{ display: "flex", justifyContent: "center", marginTop: 4, fontSize: 20, color: "#a3a3a3", textShadow }}>
                  {formatDate(oldest!.takenAt)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", width: PHOTO_WIDTH }}>
                <div style={{ display: "flex", width: PHOTO_WIDTH, height: PHOTO_HEIGHT, borderRadius: 28, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={afterPhoto!} width={PHOTO_WIDTH} height={PHOTO_HEIGHT} style={{ objectFit: "cover" }} />
                </div>
                <span style={{ display: "flex", justifyContent: "center", marginTop: 14, fontSize: 24, fontWeight: 700, color: "white", textShadow }}>
                  {t.afterLabel}
                </span>
                <span style={{ display: "flex", justifyContent: "center", marginTop: 4, fontSize: 20, color: "#a3a3a3", textShadow }}>
                  {formatDate(latest!.takenAt)}
                </span>
              </div>
            </div>
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
      "Content-Disposition": `attachment; filename="moopata-before-after-${angle.toLowerCase()}.png"`,
      // Private (never shared/CDN cache — these are the user's own body
      // photos) with a short max-age, same reasoning as every other share
      // route's Cache-Control comment.
      "Cache-Control": "private, max-age=120",
    },
  });
}
