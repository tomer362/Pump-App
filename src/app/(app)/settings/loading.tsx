import { SkeletonHeader, SkeletonRows } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="36%" />
      <div className="mt-4 space-y-4 px-4">
        <SkeletonRows rows={4} />
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
