"use client";

import { useRef, useState } from "react";

export interface NutrientPage {
  key: string;
  label: string;
  eaten: number;
  target: number | null;
  unit: string;
  color: string;
  bonusNote?: string;
}

const SIZE = 168;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function NutrientRing({ page }: { page: NutrientPage }) {
  const target = page.target ?? 0;
  const pct = target > 0 ? Math.min(page.eaten / target, 1) : 0;
  const over = target > 0 && page.eaten > target;
  const offset = CIRCUMFERENCE * (1 - pct);
  const remaining = Math.max(target - page.eaten, 0);

  return (
    <div className="flex w-full flex-none snap-center flex-col items-center px-2">
      <p className="mb-2 text-xs text-neutral-500">{page.label}</p>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#e8e0d0" strokeWidth={STROKE} />
          {target > 0 && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={over ? "#ef4444" : page.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tabular-nums tracking-tight">{Math.round(page.eaten).toLocaleString("th-TH")}</span>
          <span className="text-[11px] text-neutral-500">
            {page.target !== null ? `จากเป้า ${Math.round(page.target).toLocaleString("th-TH")} ${page.unit}` : page.unit}
          </span>
          {page.target !== null && (
            <span className={`mt-1 text-[11px] font-medium ${over ? "text-red-400" : "text-neutral-400"}`}>
              {over
                ? `เกินไป ${Math.round(page.eaten - target).toLocaleString("th-TH")} ${page.unit}`
                : `เหลืออีก ${Math.round(remaining).toLocaleString("th-TH")} ${page.unit}`}
            </span>
          )}
        </div>
      </div>
      {page.bonusNote && <p className="mt-2 text-center text-[11px] text-neutral-600">{page.bonusNote}</p>}
    </div>
  );
}

// Swipeable "one nutrient at a time" view — calories, then protein/carb/fat
// each as their own ring — matching the reference app's diary carousel
// instead of cramming everything into one static block.
export function NutrientCarousel({ pages }: { pages: NutrientPage[] }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIndex(i);
    }, 80);
  }

  function goTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((p) => (
          <NutrientRing key={p.key} page={p} />
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {pages.map((p, i) => (
          <button
            key={p.key}
            onClick={() => goTo(i)}
            aria-label={p.label}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-[#fc4c02]" : "w-1.5 bg-neutral-700"}`}
          />
        ))}
      </div>
    </div>
  );
}
