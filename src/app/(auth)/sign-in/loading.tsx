import { Skeleton } from "@/components/ui/skeleton";

/**
 * The sign-in page checks the session before it renders, so a cold load
 * showed nothing at all until the database answered. Same shape as the view
 * it stands in for: wordmark high, one primary button low.
 */
export default function SignInLoading() {
  return (
    <main className="px-safe-6 flex min-h-screen-d flex-col pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-end pb-10">
        <Skeleton className="mb-3 h-8 w-32 rounded-lg" />
        <Skeleton className="h-5 w-56 rounded-md" />
      </div>
      <div className="pb-6">
        <Skeleton className="h-12 w-full rounded-field" />
      </div>
    </main>
  );
}
