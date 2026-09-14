import { readFile } from "fs/promises";
import path from "path";

let cached: string | null = null;

// The mascot icon shown in the activity share card's header
// (src/app/api/share/[id]/route.tsx) — embedded as a base64 data URI rather
// than referenced by URL, same reason share-fonts.ts loads its .ttf files
// directly off disk: next/og's renderer (satori) has no notion of this
// app's own base URL to resolve a relative <img src> against. Cached in
// memory since the file never changes between requests.
export async function loadMascotLogoDataUri(): Promise<string> {
  if (cached) return cached;
  const buf = await readFile(path.join(process.cwd(), "public", "mascot-1.png"));
  cached = `data:image/png;base64,${buf.toString("base64")}`;
  return cached;
}
