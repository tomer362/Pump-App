import { Skeleton, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function RoutineDetailLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="56%" />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="rounded-field h-12" />
        <SkeletonRows rows={5} />
      </div>
    </div>
  );
}
