import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(req: Request) {
  destroySession();
  const appUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  return NextResponse.redirect(`${appUrl}/`, { status: 303 });
}
