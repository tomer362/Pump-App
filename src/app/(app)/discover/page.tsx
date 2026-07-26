import { Compass } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { EmptyState } from "@/components/ui/primitives";
import { PostCard } from "@/components/social/post-card";
import { requireUser } from "@/lib/session";
import { getDiscoveryFeed } from "@/lib/queries/social";

export default async function DiscoverPage() {
  const me = await requireUser();
  const items = await getDiscoveryFeed(me.id, 30);

  return (
    <div className="pb-8">
      <NavBar
        title="Discover"
        back="/feed"
        subtitle="Sessions from people you don't follow yet"
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing to discover yet"
          body="As more people log workouts, their sessions show up here."
        />
      ) : (
        <div className="space-y-3 px-4">
          {items.map((item) => (
            <PostCard key={item.postId} item={item} unit={me.unit} />
          ))}
        </div>
      )}
    </div>
  );
}
