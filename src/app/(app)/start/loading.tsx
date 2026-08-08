import { Skeleton, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function StartLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="34%" />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="rounded-card h-12" />
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
