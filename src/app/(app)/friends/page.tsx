import { Users } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { PersonRow } from "@/components/social/person-row";
import { PeopleSearch } from "@/components/social/people-search";
import { requireUser } from "@/lib/session";
import {
  getFriends,
  getPendingFriendRequests,
  getSentFriendRequests,
  searchPeople,
} from "@/lib/queries/social";

export default async function FriendsPage() {
  const me = await requireUser();
  const [friends, pending, sent, suggestions] = await Promise.all([
    getFriends(me.id),
    getPendingFriendRequests(me.id),
    getSentFriendRequests(me.id),
    searchPeople(me.id, "", 12),
  ]);

  const friendIds = new Set(friends.map((f) => f.id));
  const suggested = suggestions.filter(
    (p) => !friendIds.has(p.id) && p.friendStatus === "none",
  );

  return (
    <div className="pb-8">
      <NavBar title="Friends" back="/profile" />

      <div className="px-safe-4">
        <PeopleSearch />
      </div>

      {pending.length > 0 && (
        <div className="mt-6 px-4">
          <SectionTitle>Requests</SectionTitle>
          <Card className="divide-hairline divide-y overflow-hidden">
            {pending.map((p) => (
              <PersonRow key={p.id} person={p} showFollow={false} />
            ))}
          </Card>
        </div>
      )}

      {sent.length > 0 && (
        <div className="mt-6 px-4">
          <SectionTitle>Sent</SectionTitle>
          <Card className="divide-hairline divide-y overflow-hidden">
            {sent.map((p) => (
              <PersonRow key={p.id} person={p} showFollow={false} />
            ))}
          </Card>
        </div>
      )}

      <div className="mt-6 px-4">
        <SectionTitle>Your friends</SectionTitle>
        {friends.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No friends yet"
            body="Search for people by name or username. Friends can see when you're at the gym."
          />
        ) : (
          <Card className="divide-hairline divide-y overflow-hidden">
            {friends.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </Card>
        )}
      </div>

      {suggested.length > 0 && (
        <div className="mt-6 px-4">
          <SectionTitle>People on Pump</SectionTitle>
          <Card className="divide-hairline divide-y overflow-hidden">
            {suggested.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
