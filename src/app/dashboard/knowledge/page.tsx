import Link from "next/link";
import { getTranslations } from "next-intl/server";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-3 font-medium text-neutral-100">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-neutral-400">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-neutral-950/60 px-3 py-2 font-mono text-xs text-neutral-300">{children}</p>;
}

export default async function KnowledgePage() {
  const t = await getTranslations("knowledge");
  const tdeeList = t.raw("tdeeList") as string[];
  const macroList = t.raw("macroList") as string[];
  const activityList = t.raw("activityList") as string[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard/nutrition" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("backLink")}
      </Link>

      <h1 className="mb-1 text-xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-sm text-neutral-500">{t("subtitle")}</p>

      <Section title={t("bmrTitle")}>
        <p>{t("bmrP1")}</p>
        <Formula>{t("bmrFormulaMale")}</Formula>
        <Formula>{t("bmrFormulaFemale")}</Formula>
        <p>{t.rich("bmrP2", { strong: (chunks) => <strong>{chunks}</strong> })}</p>
        <Formula>{t("bmrFormulaLbm")}</Formula>
        <Formula>{t("bmrFormulaKatch")}</Formula>
        <p>{t("bmrP3")}</p>
      </Section>

      <Section title={t("tdeeTitle")}>
        <p>{t("tdeeP1")}</p>
        <ul className="ml-4 list-disc space-y-1">
          {tdeeList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title={t("goalTitle")}>
        <p>{t("goalP1")}</p>
        <Formula>{t("goalFormula")}</Formula>
        <p>{t("goalP2")}</p>
      </Section>

      <Section title={t("macroTitle")}>
        <ul className="ml-4 list-disc space-y-1">
          {macroList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t("macroExample")}</p>
      </Section>

      <Section title={t("waterTitle")}>
        <Formula>{t("waterFormula")}</Formula>
        <p>{t("waterP1")}</p>
      </Section>

      <Section title={t("activityTitle")}>
        <p>{t("activityP1")}</p>
        <ul className="ml-4 list-disc space-y-1">
          {activityList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t("activityP2")}</p>
      </Section>

      <Section title={t("weightTitle")}>
        <p>{t("weightP1")}</p>
      </Section>

      <p className="mt-2 text-xs text-neutral-600">{t("footer")}</p>
    </main>
  );
}
