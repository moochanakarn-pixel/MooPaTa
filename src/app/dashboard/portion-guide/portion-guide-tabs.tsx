"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface PortionExample {
  food: string;
  grams: string;
  range: string;
}

interface PortionCategory {
  key: string;
  label: string;
  handPart: string;
  instruction: string;
  examples: PortionExample[];
}

function HandIcon({ variant }: { variant: "palm" | "fist" | "thumb" }) {
  const paths: Record<typeof variant, string> = {
    palm: "M8 21v-8.5a2 2 0 0 1 4 0V11a2 2 0 0 1 4 0v1.5a2 2 0 0 1 4 0V16c0 3-2 5-5 5H8Zm0 0-2-3.5c-.5-1 .3-2 1.3-1.7L8 16",
    fist: "M7 10V7a2 2 0 0 1 4 0v2m0-2a2 2 0 0 1 4 0v2m0-1a2 2 0 0 1 4 0v3c0 4-2.5 6-6 6H10c-2 0-3-1-3.5-2.5L5 12.5c-.5-1 .5-2 1.5-1.3L8 13",
    thumb: "M12 21v-9a2 2 0 0 1 4 0v1c2 0 3 1 3 3v2c0 2-1 3-3 3h-4Zm0 0c-2 0-3-1-3-3v-4l1-5a1.5 1.5 0 0 1 3 0v5",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-lime-400">
      <path d={paths[variant]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HAND_ICON_BY_CATEGORY: Record<string, "palm" | "fist" | "thumb"> = {
  protein: "palm",
  carb: "fist",
  fat: "thumb",
  veg: "fist",
};

export function PortionGuideTabs() {
  const t = useTranslations("portionGuide");
  // Hand-based portion estimation — a common technique for eyeballing a
  // serving size without a kitchen scale (one hand part per macro group).
  // Figures are general guidelines like the rest of the app's catalog data
  // (see thai-food-catalog.ts's own comment) — a starting estimate, not a
  // substitute for weighing food when precision actually matters. Read via
  // t.raw() since it's a whole nested array/object, not a single string to
  // interpolate.
  const CATEGORIES = t.raw("categories") as PortionCategory[];
  const [active, setActive] = useState(CATEGORIES[0].key);
  const category = CATEGORIES.find((c) => c.key === active) ?? CATEGORIES[0];

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60 p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active === c.key ? "bg-lime-600 text-white" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
        <HandIcon variant={HAND_ICON_BY_CATEGORY[category.key]} />
        <p className="text-sm text-neutral-300">
          {category.instruction} — <span className="text-neutral-500">{category.handPart}</span>
        </p>
      </div>

      <div className="space-y-2">
        {category.examples.map((ex) => (
          <div key={ex.food} className="flex items-center justify-between rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
            <span className="text-sm text-neutral-200">{ex.food}</span>
            <span className="text-right text-sm">
              <span className="font-semibold text-neutral-100">{ex.grams}</span>{" "}
              <span className="text-xs text-neutral-500">({ex.range})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
