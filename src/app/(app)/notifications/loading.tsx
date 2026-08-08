import { SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="58%" />
      <div className="mt-4 px-4">
        <SkeletonRows rows={6} />
      </div>
    </div>
  );
}
