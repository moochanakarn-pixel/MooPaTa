"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type PushStatus = "checking" | "unsupported" | "no_subscription" | "subscribed";

// Same shape as WheyReminderToggle (src/app/dashboard/supplements) — this
// only toggles the per-user weeklySummaryEnabled flag, it doesn't manage
// the browser subscription itself, reusing whichever PushSubscription the
// device already has from the water-reminder toggle on the food page (one
// subscribe/unsubscribe flow in the app, not several that could drift out
// of sync). Lives on the settings page rather than a specific feature page
// like water/whey do, since a weekly recap spans the whole app (activity +
// food + weight) rather than one domain — and settings is the one page
// already in i18n scope for a general, translated toggle like this.
//
// Owns the whole card (icon + heading + description), not just the toggle
// button — like WheyReminderToggle does — so `pushStatus === "checking" ||
// "unsupported"` hides the entire section together. Splitting the heading
// out into the (server-rendered) settings page while this component
// returned null for its own content used to leave a dead card behind: a
// heading + description with no button and no explanation for anyone on
// an unsupported browser (or, briefly, while the check itself is still
// running).
export function WeeklySummaryToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useTranslations("settings.weeklySummary");
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushStatus("unsupported");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setPushStatus(existing ? "subscribed" : "no_subscription");
    }
    check().catch(() => setPushStatus("unsupported"));
  }, []);

  async function toggle(next: boolean) {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/weekly-summary", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setSaving(false);
    if (res.ok) {
      setEnabled(next);
    } else {
      setError(t("saveError"));
    }
  }

  if (pushStatus === "checking" || pushStatus === "unsupported") return null;

  return (
    <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="M12 4a5 5 0 0 0-5 5v3.5L5 16h14l-2-3.5V9a5 5 0 0 0-5-5ZM9.5 19a2.5 2.5 0 0 0 5 0"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-medium">{t("heading")}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{t("desc")}</p>
        </div>
        {pushStatus === "subscribed" && (
          <button
            onClick={() => toggle(!enabled)}
            disabled={saving}
            className={`flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              enabled
                ? "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                : "bg-lime-600 text-white hover:bg-lime-500"
            }`}
          >
            {saving ? t("saving") : enabled ? t("disable") : t("enable")}
          </button>
        )}
      </div>

      {pushStatus === "no_subscription" && (
        <p className="text-xs text-amber-400">
          {t.rich("needsPush", {
            link: (chunks) => (
              <Link href="/dashboard/food" className="underline hover:text-amber-300">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
