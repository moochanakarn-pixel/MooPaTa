"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface TabDef {
  id: "home" | "diary" | "insights" | "account";
  href: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
}

const TAB_DEFS: TabDef[] = [
  {
    id: "home",
    href: "/dashboard",
    match: (p) => p === "/dashboard",
    icon: (
      <path
        d="M3 10.5 10 4l7 6.5M5 9v7a1 1 0 0 0 1 1h3v-5h2v5h3a1 1 0 0 0 1-1V9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "diary",
    href: "/dashboard/food",
    match: (p) => p.startsWith("/dashboard/food") || p.startsWith("/dashboard/portion-guide"),
    icon: (
      <path
        d="M5 3v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6.5L11.5 3H6a1 1 0 0 0-1 0Z M11 3v3.5a1 1 0 0 0 1 1H15M8 11h4M8 14h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "insights",
    href: "/dashboard/nutrition",
    match: (p) => p.startsWith("/dashboard/nutrition") || p.startsWith("/dashboard/knowledge"),
    icon: (
      <path
        d="M4 16V9a2 2 0 0 1 2-2h1V4h2v3h2V4h2v3h1a2 2 0 0 1 2 2v7M4 16h12M4 16v0a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "account",
    href: "/dashboard/settings",
    match: (p) => p.startsWith("/dashboard/settings"),
    icon: (
      <>
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 17c0-3 3-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
];

interface QuickActionDef {
  id: "addFood" | "logActivity" | "supplements" | "logWeight" | "progressPhoto" | "inbody";
  href: string;
  color: string;
  icon: React.ReactNode;
}

const QUICK_ACTION_DEFS: QuickActionDef[] = [
  {
    id: "addFood",
    href: "/dashboard/food",
    color: "text-rose-400",
    icon: (
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: "logActivity",
    href: "/dashboard/log-activity",
    color: "text-emerald-400",
    icon: (
      <path
        d="M4 18c2-3 4-3 6 0s4 3 6 0M4 12c2-3 4-3 6 0s4 3 6 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "supplements",
    href: "/dashboard/supplements",
    color: "text-violet-400",
    icon: (
      <path
        d="M6.5 3.5h7L15 6v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6l1.5-2.5ZM5 9.5h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "logWeight",
    href: "/dashboard/nutrition",
    color: "text-sky-400",
    icon: (
      <>
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.5v3.8l2.6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    id: "progressPhoto",
    href: "/dashboard/nutrition?quick=photo",
    color: "text-cyan-400",
    icon: (
      <path
        d="M4 7a1 1 0 0 1 1-1h1.5l1-1.5h5l1 1.5H15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "inbody",
    href: "/dashboard/nutrition?quick=inbody",
    color: "text-fuchsia-400",
    icon: (
      <>
        <circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 8h4M10 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
];

// Fixed bottom navigation shared by every /dashboard/* page, matching the
// tab-bar-plus-center-FAB layout of dedicated nutrition-tracking apps
// (home / diary / quick-add / insights / account). Deep pages that don't
// have their own tab (records, compare, achievements, activity detail) are
// still reachable via links from Home — this only replaces top-level
// navigation, not the pages themselves.
export function BottomNav() {
  const t = useTranslations("bottomNav");
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const TABS = TAB_DEFS.map((tab) => ({ ...tab, label: t(`tabs.${tab.id}`) }));
  const QUICK_ACTIONS = QUICK_ACTION_DEFS.map((action) => ({ ...action, label: t(`quickActions.${action.id}`) }));

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSheetOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-neutral-800 bg-neutral-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-700" />
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  onClick={() => setSheetOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 py-4 text-center transition hover:border-neutral-700 hover:bg-neutral-800/60"
                >
                  <svg viewBox="0 0 20 20" fill="none" className={`h-6 w-6 ${a.color}`}>
                    {a.icon}
                  </svg>
                  <span className="text-xs text-neutral-300">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-2">
          {TABS.slice(0, 2).map((tab) => (
            <NavTab key={tab.href} tab={tab} active={tab.match(pathname)} />
          ))}

          <button
            onClick={() => setSheetOpen((v) => !v)}
            aria-label={t("addData")}
            className="relative -top-3 flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[#fc4c02] text-white shadow-lg shadow-[#fc4c02]/30 transition hover:bg-[#e04402]"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {TABS.slice(2).map((tab) => (
            <NavTab key={tab.href} tab={tab} active={tab.match(pathname)} />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavTab({ tab, active }: { tab: TabDef & { label: string }; active: boolean }) {
  return (
    <Link
      href={tab.href}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition ${
        active ? "text-[#fc4c02]" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
        {tab.icon}
      </svg>
      {tab.label}
    </Link>
  );
}
