import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignInView } from "./sign-in-view";

export default async function SignInPage() {
  const current = await getCurrentUser();
  if (current) redirect(current.onboardedAt ? "/feed" : "/onboarding");
  return <SignInView />;
}
