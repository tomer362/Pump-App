import {
  SkeletonHeader,
  SkeletonRows,
  SkeletonSegmented,
} from "@/components/ui/skeleton";

export default function ExercisesLoading() {
  return (
    <div className="pb-8">
      <SkeletonHeader width="52%" />
      <div className="mt-4 space-y-4 px-4">
        <SkeletonSegmented />
        <SkeletonRows rows={8} />
      </div>
    </div>
  );
}
