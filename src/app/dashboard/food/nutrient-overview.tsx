"use client";

import { type ReactNode } from "react";

export interface NutrientPage {
  key: string;
  label: string;
  eaten: number;
  target: number | null;
  unit: string;
  color: string;
  bonusNote?: string;
}

// A trailing block that isn't a ring — the micronutrient badge grid, which
// has no single "eaten vs target" number to show as a circle.
export interface CustomPage {
  key: string;
  label: string;
  content: ReactNode;
}

const MAIN_SIZE = 148;
const MAIN_STROKE = 13;
const MAIN_RADIUS = (MAIN_SIZE - MAIN_STROKE) / 2;
const MAIN_CIRCUMFERENCE = 2 * Math.PI * MAIN_RADIUS;

const MACRO_SIZE = 84;
const MACRO_STROKE = 8;
const MACRO_RADIUS = (MACRO_SIZE - MACRO_STROKE) / 2;
const MACRO_CIRCUMFERENCE = 2 * Math.PI * MACRO_RADIUS;

function ringMetrics(page: NutrientPage) {
  const target = page.target ?? 0;
  const pct = target > 0 ? Math.min(page.eaten / target, 1) : 0;
  const over = target > 0 && page.eaten > target;
  const remaining = Math.max(target - page.eaten, 0);
  return { target, pct, over, remaining };
}

// The track-plus-progress-arc SVG shared by MainRing and MacroRing — the
// two differ only in size/stroke and in what they render inside/below the
// circle, not in how the circle itself is drawn.
function RingGauge({
  size,
  stroke,
  radius,
  circumference,
  color,
  over,
  offset,
  showProgress,
  children,
}: {
  size: number;
  stroke: number;
  radius: number;
  circumference: number;
  color: string;
  over: boolean;
  offset: number;
  showProgress: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e8e0d0" strokeWidth={stroke} />
        {showProgress && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={over ? "#ef4444" : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function MainRing({ page }: { page: NutrientPage }) {
  const { target, pct, over, remaining } = ringMetrics(page);
  const offset = MAIN_CIRCUMFERENCE * (1 - pct);
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-xs text-neutral-500">{page.label}</p>
      <RingGauge
        size={MAIN_SIZE}
        stroke={MAIN_STROKE}
        radius={MAIN_RADIUS}
        circumference={MAIN_CIRCUMFERENCE}
        color={page.color}
        over={over}
        offset={offset}
        showProgress={target > 0}
      >
        <span className="text-xl font-extrabold tabular-nums tracking-tight">{Math.round(page.eaten).toLocaleString("th-TH")}</span>
        <span className="text-[10px] text-neutral-500">
          {page.target !== null ? `จากเป้า ${Math.round(page.target).toLocaleString("th-TH")} ${page.unit}` : page.unit}
        </span>
        {page.target !== null && (
          <span className={`mt-0.5 text-[10px] font-medium ${over ? "text-red-400" : "text-neutral-400"}`}>
            {over
              ? `เกิน ${Math.round(page.eaten - target).toLocaleString("th-TH")}`
              : `เหลือ ${Math.round(remaining).toLocaleString("th-TH")}`}
          </span>
        )}
      </RingGauge>
      {page.bonusNote && <p className="mt-1.5 max-w-[11rem] text-center text-[10px] text-neutral-600">{page.bonusNote}</p>}
    </div>
  );
}

// A smaller ring for the three macros, sized to sit three-across under the
// calorie ring without needing to scroll — the whole point of replacing the
// old one-ring-at-a-time swipe carousel, which hid protein/carb/fat off to
// the side until you swiped to them.
function MacroRing({ page }: { page: NutrientPage }) {
  const { target, pct, over, remaining } = ringMetrics(page);
  const offset = MACRO_CIRCUMFERENCE * (1 - pct);
  return (
    <div className="flex flex-1 flex-col items-center">
      <RingGauge
        size={MACRO_SIZE}
        stroke={MACRO_STROKE}
        radius={MACRO_RADIUS}
        circumference={MACRO_CIRCUMFERENCE}
        color={page.color}
        over={over}
        offset={offset}
        showProgress={target > 0}
      >
        <span className="text-sm font-bold tabular-nums">{Math.round(page.eaten)}</span>
      </RingGauge>
      <p className="mt-1.5 text-[11px] text-neutral-400">{page.label}</p>
      <p className="text-[10px] text-neutral-600">{page.target !== null ? `/${Math.round(page.target)} ${page.unit}` : page.unit}</p>
      {page.bonusNote && <p className="mt-0.5 max-w-[6.5rem] text-center text-[9px] text-neutral-600">{page.bonusNote}</p>}
    </div>
  );
}

// Every ring — calories, then protein/carb/fat — plus the optional
// micronutrient grid, all visible on screen at once instead of a
// swipe-through-one-at-a-time carousel: calories gets the big ring up top,
// the three macros sit in a row underneath at a smaller size, and
// micronutrients (when present) follow as a normal block below.
export function NutrientOverview({ pages, extraPage }: { pages: NutrientPage[]; extraPage?: CustomPage }) {
  const [main, ...rest] = pages;
  return (
    <div>
      {main && (
        <div className="mb-4 flex justify-center">
          <MainRing page={main} />
        </div>
      )}
      {rest.length > 0 && (
        <div className="flex items-start justify-center gap-2">
          {rest.map((p) => (
            <MacroRing key={p.key} page={p} />
          ))}
        </div>
      )}
      {extraPage && (
        <div className="mt-4 border-t border-neutral-800/60 pt-4">
          <p className="mb-2 text-center text-xs text-neutral-500">{extraPage.label}</p>
          {extraPage.content}
        </div>
      )}
    </div>
  );
}
