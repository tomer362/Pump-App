import { Building2 } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { GymManager } from "./gym-manager";
import { requireUser } from "@/lib/session";
import { getMyGyms } from "@/lib/queries/social";

export default async function GymsPage() {
  const me = await requireUser();
  const gyms = await getMyGyms(me.id);

  return (
    <div className="pb-8">
      <NavBar
        title="Gyms"
        back="/profile"
        subtitle="Where you train, and who else is there"
      />

      <div className="px-4">
        <GymManager gyms={gyms} homeGymId={me.homeGymId} />

        {gyms.length === 0 && (
          <>
            <SectionTitle className="mt-8">Why add a gym?</SectionTitle>
            <EmptyState
              icon={Building2}
              title="Train with the people around you"
              body="Add your gym and share the join code. Members see each other's check-ins, so you know when someone's already there."
            />
          </>
        )}
      </div>
    </div>
  );
}
