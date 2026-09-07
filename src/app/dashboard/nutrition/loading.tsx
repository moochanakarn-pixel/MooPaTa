import { SkeletonBlock } from "../skeleton";

export default function NutritionLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <SkeletonBlock className="mb-6 h-5 w-32" />
      <SkeletonBlock className="mb-8 h-6 w-40" />
      <SkeletonBlock className="mb-6 h-40" />
      <SkeletonBlock className="mb-6 h-64" />
      <SkeletonBlock className="mb-6 h-40" />
      <SkeletonBlock className="h-40" />
    </main>
  );
}
