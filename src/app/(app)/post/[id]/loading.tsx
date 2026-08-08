import { SkeletonCard, SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function PostLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="34%" />
      <div className="mt-4 space-y-4 px-4">
        <SkeletonCard />
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
