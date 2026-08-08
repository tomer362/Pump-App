import { SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function DiscoverLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="46%" />
      <div className="mt-4 px-4">
        <SkeletonRows rows={6} />
      </div>
    </div>
  );
}
