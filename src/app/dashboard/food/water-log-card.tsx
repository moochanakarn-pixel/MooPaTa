"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
export interface WaterLogEntry {
  id: string;
  ml: number;
  loggedAtMs: number;
}

const QUICK_ADD_ML = [250, 350, 500];
const GLASS_ML = 250;
const MIN_GLASSES = 4;
const MAX_GLASSES = 14;

function WaterGlass({
  fillPct,
  tappable,
  onTap,
  fillLabel,
}: {
  fillPct: number;
  tappable: boolean;
  onTap?: () => void;
  fillLabel: string;
}) {
  const Tag = tappable ? "button" : "div";
  return (
    <Tag
      onClick={tappable ? onTap : undefined}
      title={tappable ? fillLabel : undefined}
      className={`relative h-11 w-7 flex-none overflow-hidden rounded-b-xl rounded-t-md border-2 transition ${
        fillPct > 0 ? "border-cyan-600/50" : "border-neutral-700"
      } ${tappable ? "cursor-pointer hover:border-cyan-500" : ""}`}
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-cyan-400 to-cyan-600 transition-all"
        style={{ height: `${fillPct}%` }}
      />
    </Tag>
  );
}

// Kalguroo-style row of glasses: each one represents a standard 250ml
// serving, filled bottom-up by today's total — tapping the next empty
// glass is a one-tap way to log exactly that serving, same amount the
// +250 quick-add button below does.
function WaterGlasses({
  totalMl,
  targetMl,
  onAddGlass,
  disabled,
  fillLabel,
}: {
  totalMl: number;
  targetMl: number | null;
  onAddGlass: () => void;
  disabled: boolean;
  fillLabel: string;
}) {
  const glassCount = Math.min(Math.max(Math.ceil((targetMl ?? 2000) / GLASS_ML), MIN_GLASSES), MAX_GLASSES);
  const filledGlasses = Math.floor(totalMl / GLASS_ML);
  const remainderMl = totalMl % GLASS_ML;
  const partialPct = (remainderMl / GLASS_ML) * 100;
  // Any logged amount that isn't an exact multiple of 250 (a +300/+500
  // quick-add, a custom amount) leaves a partially-filled glass sitting at
  // index filledGlasses — the next fully-empty glass is the one after that,
  // not filledGlasses itself, or nothing would ever be tappable again.
  const nextEmptyIndex = remainderMl > 0 ? filledGlasses + 1 : filledGlasses;

  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: glassCount }, (_, i) => {
        const fillPct = i < filledGlasses ? 100 : i === filledGlasses && remainderMl > 0 ? partialPct : 0;
        const isNextEmptySlot = i === nextEmptyIndex;
        return (
          <WaterGlass
            key={i}
            fillPct={fillPct}
            tappable={!disabled && isNextEmptySlot}
            onTap={onAddGlass}
            fillLabel={fillLabel}
          />
        );
      })}
    </div>
  );
}

// Quick-add water logging for the viewed day (today by default, or a
// backfilled past day via the food page's date strip) — same "which day"
// context as FoodLogView, kept as a separate component/API since water
// isn't a Food/FoodLog.
export function WaterLogCard({
  todayLogs,
  targetMl,
  viewDate,
  isToday,
}: {
  todayLogs: WaterLogEntry[];
  targetMl: number | null;
  viewDate: string;
  isToday: boolean;
}) {
  const t = useTranslations("food.waterLogCard");
  const router = useRouter();
  const [adding, setAdding] = useState<number | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [customMl, setCustomMl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totalMl = todayLogs.reduce((sum, l) => sum + l.ml, 0);
  // The most recently added entry — the only one "ลบรายการล่าสุด" ever
  // needs, so a mis-tap (or logging the wrong amount) can be corrected
  // without showing every entry logged today as a growing row of pills,
  // which got unreadable fast once someone logged more than 3-4 times.
  // Relies on todayLogs already arriving in insertion order (the query
  // orders by loggedAt then id — every entry on a backfilled day shares
  // the exact same loggedAt, so id is what actually breaks the tie), so
  // the last element IS the last one added — a manual max-by-timestamp
  // reduce would silently pick an arbitrary tied entry instead on those
  // days, since it can't distinguish same-loggedAt rows at all.
  const lastEntry = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1] : null;

  async function addWater(ml: number) {
    if (!Number.isFinite(ml) || ml <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    setError(null);
    setAdding(ml);
    const res = await fetch("/api/water/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ml, ...(isToday ? {} : { loggedAt: viewDate }) }),
    });
    setAdding(null);
    if (res.ok) {
      setCustomMl("");
      router.refresh();
    } else {
      setError(t("saveFailed"));
    }
  }

  async function undoLast() {
    if (!lastEntry) return;
    setUndoing(true);
    const res = await fetch(`/api/water/log/${lastEntry.id}`, { method: "DELETE" });
    setUndoing(false);
    if (res.ok) router.refresh();
    else setError(t("undoFailed"));
  }

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="M12 3c2.5 3.2 6 7.5 6 11.2a6 6 0 0 1-12 0C6 10.5 9.5 6.2 12 3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-medium">{t("title")}</h2>
      </div>

      <p className="mb-3 text-3xl font-bold tabular-nums">
        {(totalMl / 1000).toFixed(2)}
        {targetMl && (
          <span className="text-lg font-medium text-neutral-500"> / {t("liters", { value: (targetMl / 1000).toFixed(1) })}</span>
        )}
        {!targetMl && <span className="text-lg font-medium text-neutral-500"> {t("litersUnit")}</span>}
      </p>
      <div className="mb-4">
        <WaterGlasses
          totalMl={totalMl}
          targetMl={targetMl}
          onAddGlass={() => addWater(GLASS_ML)}
          disabled={adding !== null}
          fillLabel={t("fillGlass", { ml: GLASS_ML })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_ADD_ML.map((ml) => (
          <button
            key={ml}
            onClick={() => addWater(ml)}
            disabled={adding !== null}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-cyan-700 hover:text-cyan-300 disabled:opacity-50"
          >
            {t("quickAdd", { ml })}
          </button>
        ))}
        <input
          type="number"
          min="1"
          value={customMl}
          onChange={(e) => setCustomMl(e.target.value)}
          placeholder={t("customPlaceholder")}
          className="w-32 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600"
        />
        <button
          onClick={() => addWater(Number(customMl))}
          disabled={adding !== null || !customMl}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {t("add")}
        </button>
        {lastEntry && (
          <button
            onClick={undoLast}
            disabled={undoing}
            title={t("undoLastTitle", { ml: lastEntry.ml })}
            className="ml-auto flex items-center gap-1 text-xs text-neutral-500 transition hover:text-red-300 disabled:opacity-50"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
              <path d="M8 5 4 9l4 4M4 9h8a4 4 0 0 1 0 8h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {undoing ? t("undoing") : t("undoLast")}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
