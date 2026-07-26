import { notFound } from "next/navigation";
import Link from "next/link";
import { Home, MapPin, Radio, Users } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Avatar, Card, List, SectionTitle } from "@/components/ui/primitives";
import { TimeAgo } from "@/components/ui/time-ago";
import { GymCode } from "./gym-code";
import { requireUser } from "@/lib/session";
import { getGymDetail } from "@/lib/queries/social";

export default async function GymPage({
  params,
}: PageProps<"/gyms/[id]">) {
  const { id } = await params;
  const me = await requireUser();
  // Returns null for a non-member, so the join code can't be read out of the
  // page by anyone who wasn't given it.
  const gym = await getGymDetail(id, me.id);
  if (!gym) notFound();

  const here = gym.members.filter((m) => m.presentSince != null);
  const rest = gym.members.filter((m) => m.presentSince == null);

  return (
    <div className="pb-8">
      <NavBar
        title={gym.name}
        back="/gyms"
        subtitle={
          gym.city
            ? `${gym.city} · ${gym.members.length} member${gym.members.length === 1 ? "" : "s"}`
            : `${gym.members.length} member${gym.members.length === 1 ? "" : "s"}`
        }
      />

      <div className="space-y-6 px-4">
        <Card className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-text-3 text-[11px] font-semibold tracking-[0.08em] uppercase">
                Join code
              </p>
              <GymCode code={gym.joinCode} />
            </div>
            {me.homeGymId === gym.id && (
              <span className="text-volt flex shrink-0 items-center gap-1 text-[11px] font-bold">
                <Home className="size-3" strokeWidth={2.8} />
                HOME
              </span>
            )}
          </div>
          <p className="text-text-3 mt-2 flex items-center gap-3 text-[12px]">
            {gym.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {gym.city}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {gym.members.length} member{gym.members.length === 1 ? "" : "s"}
            </span>
          </p>
        </Card>

        <div>
          <SectionTitle>
            {here.length ? `Here now · ${here.length}` : "Here now"}
          </SectionTitle>
          {here.length === 0 ? (
            <p className="text-text-3 border-hairline rounded-card border border-dashed px-4 py-5 text-center text-[13px]">
              Nobody&apos;s checked in. Broadcast from the feed when you get
              there.
            </p>
          ) : (
            <List>
              {here.map((m) => (
                <MemberRow key={m.id} member={m} present />
              ))}
            </List>
          )}
        </div>

        {rest.length > 0 && (
          <div>
            <SectionTitle>Members</SectionTitle>
            <List>
              {rest.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </List>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  present,
}: {
  member: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    joinedAt: Date;
    presentSince: Date | null;
    presenceNote: string | null;
  };
  present?: boolean;
}) {
  return (
    <Link
      href={`/u/${member.username ?? member.id}`}
      className="press flex items-center gap-3 px-4 py-3"
    >
      <Avatar src={member.image} name={member.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{member.name}</p>
        <p className="text-text-3 truncate text-[12px]">
          {present && member.presentSince ? (
            <>
              {/* Volt marks live state, not decoration — this is the one thing
                  on the page worth walking over for. */}
              <span className="text-volt inline-flex items-center gap-1 font-semibold">
                <Radio className="size-3" strokeWidth={2.6} />
                Training
              </span>
              {" · "}
              <TimeAgo date={member.presentSince} />
              {member.presenceNote && ` · ${member.presenceNote}`}
            </>
          ) : (
            <>
              Member since <TimeAgo date={member.joinedAt} />
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
