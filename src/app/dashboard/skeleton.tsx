// Shared pulsing placeholder block for route-level loading.tsx skeletons —
// Next.js swaps these in immediately on navigation while the target page's
// server component awaits its DB queries, so the screen never sits blank.
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-neutral-800/60 ${className}`} />;
}
