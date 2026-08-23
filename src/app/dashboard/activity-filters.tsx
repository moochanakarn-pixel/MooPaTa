"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { activityTypeLabel } from "@/lib/format";

const RANGE_OPTIONS = [
  { value: "all", label: "ทุกช่วงเวลา" },
  { value: "7", label: "7 วันล่าสุด" },
  { value: "30", label: "30 วันล่าสุด" },
  { value: "90", label: "90 วันล่าสุด" },
  { value: "365", label: "1 ปีล่าสุด" },
];

export function ActivityFilters({ types }: { types: string[] }) {
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
        defaultValue={searchParams.get("type") ?? "ALL"}
        onChange={(e) => updateParam("type", e.target.value, "ALL")}
        className={selectClass}
      >
        <option value="ALL">ทุกประเภท</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {activityTypeLabel(t)}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("range") ?? "all"}
        onChange={(e) => updateParam("range", e.target.value, "all")}
        className={selectClass}
      >
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
