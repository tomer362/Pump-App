import { SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function FriendsLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="38%" />
      <div className="mt-4 px-4">
        <SkeletonRows rows={5} />
      </div>
    </div>
  );
}
