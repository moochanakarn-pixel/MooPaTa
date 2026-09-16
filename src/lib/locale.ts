import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Fallback for pages rendered before a User row exists (landing, pre-login)
// — not sensitive, so no need for httpOnly/session-cookie treatment beyond
// matching session.ts's other cookie options. 1 year: this is a durable
// preference, not a session.
export const LOCALE_COOKIE = "moopata_locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AppLocale = "th" | "en";
const DEFAULT_LOCALE: AppLocale = "th";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "th" || value === "en";
}

export function setLocaleCookie(locale: AppLocale): void {
  cookies().set(LOCALE_COOKIE, locale, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });
}

// Logged in: User.locale is authoritative (persists cross-device/re-login,
// same as unitSystem already does) — one indexed PK lookup, single column.
// Logged out: falls back to the cookie, then the hardcoded default.
// Wrapped in React's cache() so every getTranslations()/getLocale() call
// within the same request reuses this instead of re-querying per call.
export const resolveLocale = cache(async (): Promise<AppLocale> => {
  const userId = await getSessionUserId();
  if (userId) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
    if (user) return user.locale === "EN" ? "en" : "th";
  }
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  return isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
});
