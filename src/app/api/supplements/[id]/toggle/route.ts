import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { localDateKey } from "@/lib/streak";

// Toggles "taken today" for one supplement — a SupplementLog row existing
// for today is the source of truth the checklist reflects. Always attempts
// to CREATE today's row first; a unique-constraint conflict on
// (userId, supplementId, takenDate) means one already exists (from an
// earlier click, or a concurrent request that won the race), so that's
// treated as "already taken" and every row for today is removed instead —
// this makes the toggle atomic at the database level rather than relying on
// an app-level check-then-act, which could create duplicate rows for the
// same day under a double-tap or overlapping request.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const supplement = await db.supplement.findUnique({ where: { id: params.id } });
  if (!supplement || supplement.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const takenDate = localDateKey(new Date());

  try {
    await db.supplementLog.create({ data: { userId, supplementId: params.id, takenDate } });
    return NextResponse.json({ ok: true, taken: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await db.supplementLog.deleteMany({ where: { userId, supplementId: params.id, takenDate } });
      return NextResponse.json({ ok: true, taken: false });
    }
    throw err;
  }
}
