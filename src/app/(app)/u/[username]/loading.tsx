import { Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

export default function PersonLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="44%" />
      <div className="mt-4 space-y-4 px-4">
        <Skeleton className="rounded-card h-28" />
        <SkeletonCard />
      </div>
    </div>
  );
}
