import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <main className="px-safe-6 flex min-h-screen-d flex-col pt-safe pb-safe">
      <div className="pt-10">
        <Skeleton className="mb-3 h-8 w-40 rounded-lg" />
        <Skeleton className="h-5 w-64 rounded-md" />
      </div>
      <div className="mt-8 space-y-4">
        <Skeleton className="h-12 w-full rounded-field" />
        <Skeleton className="h-12 w-full rounded-field" />
        <Skeleton className="h-12 w-2/3 rounded-field" />
      </div>
    </main>
  );
}
