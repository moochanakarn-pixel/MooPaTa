import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { setLocaleCookie } from "@/lib/locale";

// Shared by both the settings-page switcher (authenticated) and the
// landing-page switcher (not authenticated yet, e.g. before signup) —
// same shape as /api/settings/unit, plus it always sets the moopata_locale
// cookie so the choice sticks even for someone not logged in.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.locale !== "TH" && body.locale !== "EN") {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const userId = await getSessionUserId();
  if (userId) {
    await db.user.update({ where: { id: userId }, data: { locale: body.locale } });
  }

  setLocaleCookie(body.locale === "EN" ? "en" : "th");
  return NextResponse.json({ ok: true });
}
