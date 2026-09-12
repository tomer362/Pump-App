import { Skeleton, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function CoopSessionLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="48%" large={false} />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="rounded-card h-16" />
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
