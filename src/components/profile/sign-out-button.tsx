"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { clearScrollMemory } from "@/lib/scroll-memory";
import { clearSessionMemory } from "@/lib/session-memory";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      block
      variant="ghost"
      className="text-text-3"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await authClient.signOut();
        // sessionStorage outlives a sign-out in the same tab, and all of this
        // is one account's data: offsets into their history, cached rows of
        // their feed, the last thing they searched for.
        clearScrollMemory();
        clearSessionMemory();
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}
