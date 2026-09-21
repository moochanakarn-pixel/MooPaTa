"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// Same confirm()-then-fetch pattern as settings' DeleteAccountButton — the
// only way to remove a logged activity at all until this button existed
// (see PATCH/DELETE /api/activity/[id]'s comments): a mistaken duplicate
// entry, or one someone just wants gone, had no way to go away before.
// Works for any provider, not just MANUAL — unlike editing, deleting a
// Strava-era activity is unambiguous (it's just a local row, Strava sync
// is gone entirely) so there's no reason to withhold it there.
export function DeleteActivityButton({ activityId }: { activityId: string }) {
  const t = useTranslations("activityDetail.delete");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm(t("confirm"))) return;
    setPending(true);
    const res = await fetch(`/api/activity/${activityId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setPending(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:border-red-800 hover:bg-red-950/40 disabled:opacity-50"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M5 6h10M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m1.5 0-.6 9.3A2 2 0 0 1 10.9 17H9.1a2 2 0 0 1-2-1.7L6.5 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {pending ? t("deleting") : t("button")}
    </button>
  );
}
