import { Skeleton, SkeletonHeader } from "@/components/ui/skeleton";

export default function ExerciseLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="56%" />
      <div className="mt-4 space-y-6 px-4">
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    </div>
  );
}
