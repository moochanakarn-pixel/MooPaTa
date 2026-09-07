import Link from "next/link";

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

// A "getting started" checklist for brand-new accounts — matching the
// reference app's first-mission card, but as an honest 4-step checklist
// instead of a countdown/reward gimmick we have no reward system to back
// up. The caller hides this entirely once every step is done or the
// account is old enough that it'd read as nagging rather than guidance.
export function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const pct = (doneCount / steps.length) * 100;

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium">
          <span>🎁</span> เริ่มต้นใช้งาน
        </h2>
        <span className="text-xs text-neutral-500">
          {doneCount}/{steps.length}
        </span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-[#fc4c02] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-lime-500/15 text-lime-400">
                  <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
                    <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="line-through decoration-neutral-700">{s.label}</span>
              </div>
            ) : (
              <Link
                href={s.href}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-200 transition hover:bg-neutral-800/50"
              >
                <span className="h-5 w-5 flex-none rounded-full border border-neutral-700" />
                <span>{s.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
