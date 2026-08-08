import { SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function GymsLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="30%" />
      <div className="mt-4 px-4">
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
