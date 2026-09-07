"use client";

import { useState } from "react";

// Groups the deeper analytics blocks (monthly highlights, trend chart,
// heatmap, etc.) behind a single toggle so the homepage's default view is
// "today's summary, then your recent activities" instead of a long wall of
// stat cards someone has to scroll past every time.
export function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-4 flex w-full items-center justify-between rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3 text-left transition hover:border-neutral-700"
      >
        <span className="text-sm font-medium text-neutral-300">{title}</span>
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 flex-none text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
