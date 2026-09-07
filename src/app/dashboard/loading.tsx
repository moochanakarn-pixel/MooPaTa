import { SkeletonBlock } from "./skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <SkeletonBlock className="mb-8 h-24" />
      <div className="mb-6 flex gap-2">
        <SkeletonBlock className="h-9 w-32" />
        <SkeletonBlock className="h-9 w-32" />
        <SkeletonBlock className="h-9 w-32" />
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <SkeletonBlock className="mb-6 h-40" />
      <SkeletonBlock className="mb-6 h-48" />
      <SkeletonBlock className="h-64" />
    </main>
  );
}
