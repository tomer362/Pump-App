import Link from "next/link";
import { Trophy } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Card, EmptyState, Badge } from "@/components/ui/primitives";
import { requireUser } from "@/lib/session";
import { getPersonalRecords } from "@/lib/queries/workout";
import { formatWeight } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  "1rm": "Est. 1RM",
  weight: "Heaviest",
  volume: "Best set volume",
  reps: "Most reps",
};

export default async function RecordsPage() {
  const me = await requireUser();
  const records = await getPersonalRecords(me.id);

  // Group by exercise so each lift reads as one block of records — by id,
  // not name: an imported routine can mint a custom exercise named like one
  // you already had, and grouping by name merged the two under one heading.
  const byExercise = new Map<string, typeof records>();
  for (const r of records) {
    const list = byExercise.get(r.exerciseId) ?? [];
    list.push(r);
    byExercise.set(r.exerciseId, list);
  }

  return (
    <div className="pb-8">
      <NavBar title="Records" back />

      {records.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No records yet"
          body="Complete a few working sets and your bests start appearing here automatically."
        />
      ) : (
        <div className="space-y-4 px-4">
          {[...byExercise.entries()].map(([name, list]) => (
            <div key={name}>
              <Link
                href={`/exercises/${list[0].exerciseId}`}
                className="mb-1.5 block truncate text-[15px] font-semibold"
              >
                {name}
              </Link>
              <Card className="divide-hairline divide-y overflow-hidden">
                {list.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="text-text-3 flex-1 text-[13px]">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                    {r.kind === "reps" ? (
                      <span className="num text-[15px] font-bold">
                        {Math.round(r.value)} reps
                      </span>
                    ) : (
                      <span className="num text-[15px] font-bold">
                        {formatWeight(r.value, me.unit)}
                        <span className="text-text-3 ml-0.5 text-[12px]">
                          {me.unit}
                        </span>
                      </span>
                    )}
                    {r.kind === "1rm" && <Badge tone="pr">PR</Badge>}
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
