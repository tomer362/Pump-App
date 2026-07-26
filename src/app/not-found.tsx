import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen-d flex-col items-center justify-center px-8 pt-safe pb-safe">
      <Wordmark size={22} className="mb-10 opacity-40" />

      <span className="bg-surface-1 border-hairline mb-5 grid size-14 place-items-center rounded-2xl border">
        <Compass className="text-text-3 size-6" strokeWidth={1.8} />
      </span>

      <h1 className="font-display text-center text-[24px] leading-tight font-bold tracking-[-0.02em]">
        Not found
      </h1>
      <p className="text-text-3 mt-2 max-w-[34ch] text-center text-[14px] leading-relaxed">
        This workout, routine or profile doesn&apos;t exist, or isn&apos;t
        shared with you.
      </p>

      <Link href="/feed" className="mt-8 w-full max-w-xs">
        <Button variant="volt" size="lg" block>
          Back to the feed
        </Button>
      </Link>
    </main>
  );
}
