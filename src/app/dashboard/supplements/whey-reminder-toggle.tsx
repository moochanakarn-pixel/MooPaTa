"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type PushStatus = "checking" | "unsupported" | "no_subscription" | "subscribed";

// Reminds the user to drink their whey 30-60 minutes after a logged
// workout ends (src/app/api/cron/whey-reminder). Reuses whichever
// PushSubscription the device already has from the water-reminder toggle
// on the food page — this component only toggles the per-user
// wheyReminderEnabled flag, it doesn't manage the browser subscription
// itself, so there's one subscribe/unsubscribe flow in the app rather than
// two that could drift out of sync with each other.
export function WheyReminderToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useTranslations("supplements");
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
    const res = await fetch("/api/settings/whey-reminder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setSaving(false);
    if (res.ok) {
      setEnabled(next);
    } else {
      setError(t("saveFailed"));
    }
  }

  if (pushStatus === "checking" || pushStatus === "unsupported") return null;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h2 className="font-medium">{t("wheyTitle")}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{t("wheyDesc")}</p>
        </div>
        {pushStatus === "subscribed" && (
          <button
            onClick={() => toggle(!enabled)}
            disabled={saving}
            className={`flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              enabled
                ? "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                : "bg-cyan-600 text-white hover:bg-cyan-500"
            }`}
          >
            {saving ? t("saving") : enabled ? t("wheyTurnOff") : t("wheyTurnOn")}
          </button>
        )}
      </div>

      {pushStatus === "no_subscription" && (
        <p className="mt-2 text-xs text-amber-400">
          {t.rich("wheyNeedSubscription", {
            link: (chunks) => (
              <Link href="/dashboard/food" className="underline hover:text-amber-300">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
