import { Skeleton, SkeletonHeader } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="26%" />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="h-36 rounded-card" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
        </div>
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  );
}
