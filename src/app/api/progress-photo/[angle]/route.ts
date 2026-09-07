import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { PHOTO_ANGLES, angleField, contentTypeForPath, readProgressPhotoFile, type PhotoAngle } from "@/lib/progress-photo-storage";

// Streams the CURRENT user's own photo for this angle — the path always
// comes from their own User row, never from anything in the request, so
// there's no way to ask for someone else's photo by guessing a filename.
export async function GET(req: NextRequest, { params }: { params: { angle: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (!PHOTO_ANGLES.includes(params.angle as PhotoAngle)) {
    return NextResponse.json({ error: "invalid_angle" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  const relPath = user?.[angleField(params.angle as PhotoAngle)];
  if (!relPath) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buf = await readProgressPhotoFile(relPath);
  if (!buf) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentTypeForPath(relPath),
      "Cache-Control": "private, no-store",
    },
  });
}
