import { SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="pb-6">
      <SkeletonHeader width="30%" />
      <div className="mt-4 space-y-3 px-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
