import { Skeleton, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="22%" />
      <div className="mt-4 space-y-6 px-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[88px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-16 rounded-card" />
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
