import { SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function RoutinesLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="42%" />
      <div className="mt-4 px-4">
        <SkeletonRows rows={4} />
      </div>
    </div>
  );
}
