"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { activityTypeLabel } from "@/lib/format";

const RANGE_VALUES = ["all", "7", "30", "90", "365"] as const;

export function ActivityFilters({ types }: { types: string[] }) {
  const t = useTranslations("dashboard.activityFilters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string, ignoreValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ignoreValue) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    "rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-600";

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <select
        value={searchParams.get("type") ?? "ALL"}
        onChange={(e) => updateParam("type", e.target.value, "ALL")}
        className={selectClass}
      >
        <option value="ALL">{t("allTypes")}</option>
        {types.map((at) => (
          <option key={at} value={at}>
            {activityTypeLabel(at)}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("range") ?? "all"}
        onChange={(e) => updateParam("range", e.target.value, "all")}
        className={selectClass}
      >
        {RANGE_VALUES.map((value) => (
          <option key={value} value={value}>
            {t(`range.${value}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
