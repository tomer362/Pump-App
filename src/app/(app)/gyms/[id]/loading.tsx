import { Skeleton, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function GymLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="54%" />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="rounded-card h-20" />
        <SkeletonRows rows={5} />
      </div>
    </div>
  );
}
