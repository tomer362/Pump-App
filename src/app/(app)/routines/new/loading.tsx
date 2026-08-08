import { Skeleton, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function NewRoutineLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="46%" />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="rounded-field h-11" />
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
