import { Skeleton, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function WorkoutDetailLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="50%" />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="rounded-card h-24" />
        <SkeletonRows rows={4} />
      </div>
    </div>
  );
}
