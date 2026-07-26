import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { OnboardingView } from "./onboarding-view";

export default async function OnboardingPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  if (me.onboardedAt) redirect("/feed");

  return (
    <OnboardingView
      defaultName={me.name}
      suggestedUsername={suggestUsername(me.name, me.email)}
    />
  );
}

/** Seed the handle from the Google profile so most users just tap through. */
function suggestUsername(name: string, email: string) {
  const base = (name || email.split("@")[0] || "lifter")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
  return base.length >= 3 ? base : "lifter";
}
