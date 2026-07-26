"use client";

import { ErrorScreen } from "@/components/ui/error-screen";

/**
 * Scoped to the tabbed section so the tab bar in the layout above survives —
 * a failed screen shouldn't strand the user with no way to navigate.
 */
export default function TabbedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen reset={reset} digest={error.digest} />;
}
