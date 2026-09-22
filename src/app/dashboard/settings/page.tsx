import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getBuildInfo } from "@/lib/build-info";
import { getLatestBodyComposition } from "@/lib/body-composition";
import { db } from "@/lib/db";
import { computeTargets, isProfileComplete } from "@/lib/nutrition";
import { getSessionUserId } from "@/lib/session";
import { ActivityGoalsInput, DeleteAccountButton, LocaleToggle, UnitToggle } from "./settings-client";
import { NutritionProfileForm } from "./nutrition-profile-form";
import { MacroPreferencesForm } from "./macro-preferences-form";
import { HealthFlagsForm } from "./health-flags-form";
import { SetPasswordForm } from "./set-password-form";
import { ProfileForm } from "./profile-form";
import { WeeklySummaryToggle } from "./weekly-summary-toggle";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { googleLinked?: string; googleError?: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [user, activityGoals, googleConnection, t, tCommon, locale] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activityGoal.findMany({ where: { userId }, orderBy: { activityType: "asc" } }),
    db.providerConnection.findFirst({ where: { userId, provider: "GOOGLE" } }),
    getTranslations("settings"),
    getTranslations("common"),
    getLocale(),
  ]);

  const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
    denied: t("google.errors.denied"),
    invalid_state: t("google.errors.invalidState"),
    no_profile: t("google.errors.noProfile"),
    exchange_failed: t("google.errors.exchangeFailed"),
    session_changed: t("google.errors.sessionChanged"),
    linked_elsewhere: t("google.errors.linkedElsewhere"),
  };

  const nutritionProfile = {
    weightKg: user?.weightKg ?? null,
    heightCm: user?.heightCm ?? null,
    age: user?.age ?? null,
    sex: user?.sex ?? null,
    activityLevel: user?.activityLevel ?? null,
    goal: user?.nutritionGoal ?? "MAINTAIN",
    goalRateKgPerWeek: user?.goalRateKgPerWeek ?? null,
  };
  const latestBodyComposition = isProfileComplete(nutritionProfile) ? await getLatestBodyComposition(userId) : null;
  const macroPreferencesInitial = isProfileComplete(nutritionProfile)
    ? {
        proteinGPerKg: user?.proteinGPerKg ?? null,
        fatPercentOfCalories: user?.fatPercentOfCalories ?? null,
        usedBodyComposition: latestBodyComposition !== null,
        referenceWeightKg: latestBodyComposition
          ? latestBodyComposition.weightKg * (1 - latestBodyComposition.bodyFatPercent / 100)
          : nutritionProfile.weightKg,
        // Ignores any stored protein/fat override on purpose — this is the
        // calorie budget the live preview sliders compare against, and it
        // needs to be stable regardless of where those sliders currently
        // sit, not shift under the user's feet as they drag them.
        targetCaloriesAtDefaultMacros: computeTargets(nutritionProfile, latestBodyComposition).targetCalories,
      }
    : null;

  const build = getBuildInfo();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tCommon("backToOverview")}
      </Link>

      <h1 className="mb-8 text-xl font-bold">{t("title")}</h1>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-4 font-medium">{t("profile.heading")}</h2>
        <ProfileForm initialName={user?.name ?? null} hasCustomAvatar={Boolean(user?.avatarPath)} />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M4 8h16M4 16h16M9 4c-1.5 2.5-1.5 13.5 0 16M15 4c1.5 2.5 1.5 13.5 0 16"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium">{t("language.heading")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">{t("language.desc")}</p>
        <LocaleToggle initial={locale === "en" ? "en" : "th"} />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M4 15 15 4l5 5-11 11H4v-5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12.5 6.5 15 9M9.5 9.5 12 12M6.5 12.5 9 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-medium">{t("displayUnit.heading")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">{t("displayUnit.desc")}</p>
        <UnitToggle initial={user?.unitSystem ?? "METRIC"} />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#fc4c02]/10 text-[#fc4c02]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <h2 className="font-medium">{t("monthlyGoal.heading")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">{t("monthlyGoal.desc")}</p>
        <ActivityGoalsInput
          initialGoals={activityGoals.map((g) => ({ activityType: g.activityType, goalKm: g.goalKm }))}
          unit={user?.unitSystem ?? "METRIC"}
        />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M12 4c3 3 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-7 6-10Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium">{t("nutritionProfile.heading")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">
          {t.rich("nutritionProfile.desc", {
            link: (chunks) => (
              <Link href="/dashboard/nutrition" className="text-lime-400 hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <NutritionProfileForm
          initial={{
            weightKg: user?.weightKg ?? null,
            heightCm: user?.heightCm ?? null,
            age: user?.age ?? null,
            sex: user?.sex ?? null,
            activityLevel: user?.activityLevel ?? null,
            nutritionGoal: user?.nutritionGoal ?? "MAINTAIN",
            goalRateKgPerWeek: user?.goalRateKgPerWeek ?? null,
          }}
        />
      </section>

      {macroPreferencesInitial && (
        <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M4 10h12M4 6h12M4 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-medium">{t("macroPreferences.heading")}</h2>
          </div>
          <MacroPreferencesForm initial={macroPreferencesInitial} />
        </section>
      )}

      <WeeklySummaryToggle initialEnabled={user?.weeklySummaryEnabled ?? false} />

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M12 3v4M12 3 9 6M12 3l3 3M6 8h12l1.5 11.5A2 2 0 0 1 17.5 21h-11a2 2 0 0 1-2-2.5L6 8Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium">{t("healthFlags.heading")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">{t("healthFlags.desc")}</p>
        <HealthFlagsForm
          initial={{
            highCholesterol: user?.healthFlagHighCholesterol ?? false,
            highUricAcid: user?.healthFlagHighUricAcid ?? false,
          }}
        />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-neutral-500/10 text-neutral-300">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M4 6h12v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6Zm0 0 6 5 6-5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium">{t("emailLogin.heading")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">{t("emailLogin.desc")}</p>
        <SetPasswordForm currentEmail={user?.email ?? null} verified={Boolean(user?.emailVerifiedAt)} />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-neutral-500/10 text-neutral-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.89c2.28-2.1 3.56-5.2 3.56-8.81Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.89-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.29v3.09C3.26 21.3 7.31 24 12 24Z" />
              <path fill="#FBBC05" d="M5.31 14.31A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.58.38-2.31V6.6H1.29A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.29 5.4l4.02-3.09Z" />
              <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l4.02 3.09C6.25 6.87 8.89 4.77 12 4.77Z" />
            </svg>
          </div>
          <h2 className="font-medium">{t("google.heading")}</h2>
        </div>

        {searchParams.googleLinked && (
          <p className="mb-4 rounded-lg border border-lime-900/50 bg-lime-950/30 px-3 py-2 text-sm text-lime-300">
            {t("google.linkedSuccess")}
          </p>
        )}
        {searchParams.googleError && (
          <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {GOOGLE_ERROR_MESSAGES[searchParams.googleError] ?? t("google.errors.fallback", { error: searchParams.googleError })}
          </p>
        )}

        {googleConnection ? (
          <p className="text-sm text-neutral-500">{t("google.alreadyLinked")}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-neutral-500">{t("google.notLinkedDesc")}</p>
            <a
              href="/api/auth/google/connect?link=1"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
            >
              {t("google.linkButton")}
            </a>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-red-950/60 bg-red-950/10 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M5 6h14M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6m2 0-.7 12.3A2 2 0 0 1 14.3 20H9.7a2 2 0 0 1-2-1.7L7 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium text-red-300">{t("deleteAccount.heading")}</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">{t("deleteAccount.desc")}</p>
        <DeleteAccountButton />
      </section>

      {build && (
        <p className="mt-8 text-center text-xs text-neutral-700" title={build.subject}>
          {t("buildInfo", {
            commit: build.commit,
            date: new Date(build.commitDate).toLocaleString(locale === "en" ? "en-US" : "th-TH", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      )}
    </main>
  );
}
