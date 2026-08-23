import { readFile } from "fs/promises";
import path from "path";

interface ShareFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

let cached: ShareFont[] | null = null;

// Fonts for the share-card image (src/app/api/share/[id]/route.tsx). Server-side
// image generation (satori) can't use system/browser fonts, so the glyphs
// have to be loaded explicitly — and since most of the card's text is Thai,
// the default fallback font (Latin-only) would render blank boxes.
export async function loadShareFonts(): Promise<ShareFont[]> {
  if (cached) return cached;

  const dir = path.join(process.cwd(), "src/assets/fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, "NotoSansThai-Regular.ttf")),
    readFile(path.join(dir, "NotoSansThai-Bold.ttf")),
  ]);

  cached = [
    { name: "Noto Sans Thai", data: regular, weight: 400, style: "normal" },
    { name: "Noto Sans Thai", data: bold, weight: 700, style: "normal" },
  ];
  return cached;
}
