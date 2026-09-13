import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { contentTypeForPath, deleteProgressPhotoFile, readProgressPhotoFile } from "@/lib/progress-photo-storage";

// Streams one specific ProgressPhotoLog entry's image — ownership is
// checked against the row's own userId, never trusted from the request, so
// there's no way to fetch someone else's photo by guessing an id.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const log = await db.progressPhotoLog.findUnique({ where: { id: params.id } });
  if (!log || log.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buf = await readProgressPhotoFile(log.photoPath);
  if (!buf) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentTypeForPath(log.photoPath),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const log = await db.progressPhotoLog.findUnique({ where: { id: params.id } });
  if (!log || log.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.progressPhotoLog.delete({ where: { id: log.id } });
  await deleteProgressPhotoFile(log.photoPath);

  return NextResponse.json({ ok: true });
}
