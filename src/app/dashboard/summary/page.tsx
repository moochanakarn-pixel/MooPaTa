import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { resolveLocale } from "@/lib/locale";
import { SummaryConfigurator } from "./summary-configurator";

export default async function SummaryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [locale, t, tc] = await Promise.all([
    resolveLocale(),
    getTranslations("summary"),
    getTranslations("common"),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tc("backToOverview")}
      </Link>
      <h1 className="mb-1 text-xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-sm text-neutral-500">{t("subtitle")}</p>
      <SummaryConfigurator defaultLang={locale} />
    </main>
  );
}
