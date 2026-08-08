import { Skeleton, SkeletonHeader } from "@/components/ui/skeleton";

export default function CoopLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="44%" />
      <div className="mt-4 space-y-4 px-4">
        <Skeleton className="rounded-card h-24" />
        <Skeleton className="rounded-card h-24" />
      </div>
    </div>
  );
}
