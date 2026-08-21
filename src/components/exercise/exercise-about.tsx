"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Info, Play } from "lucide-react";
import { Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseStateStrips } from "./exercise-state-strips";
import { getExerciseAboutAction } from "@/lib/actions/exercise-search";
import type { ExerciseAlternativeItem } from "@/lib/queries/exercise";
import { labelize } from "@/lib/utils";

/**
 * What a movement is, as opposed to what you have done with it: the tissue it
 * works, how to perform it, a form demo, and what to do instead.
 *
 * Its own module because two surfaces show it. The exercise page reaches it
 * through `ExerciseDetailTabs`, which has three other tabs and six server
 * aggregates behind it; the routine builder shows this panel alone, in a sheet,
 * because it cannot navigate — the routine you are editing is unsaved React
 * state and leaving the page throws it away.
 */
export type ExerciseAboutData = {
  bodyEffect: string | null;
  instructions: string | null;
  secondaryMuscles: string[];
  video: { href: string; curated: boolean };
  alternatives: ExerciseAlternativeItem[];
};

/**
 * What the sheet needs on top of the panel: the identity line the page gets
 * from its `NavBar`, and the state strips it renders above its tabs. Not on
 * `ExerciseAboutData` itself — the page already has all of this and composes
 * that type into `ExerciseDetailData` from the row it loaded.
 */
export type ExerciseAboutSheetData = ExerciseAboutData & {
  name: string;
  primaryMuscle: string;
  equipment: string;
  archived: boolean;
  imported: boolean;
};

export function ExerciseAbout({ data }: { data: ExerciseAboutData }) {
  return (
    <div className="space-y-6">
      {/* Why before how: what the movement does to you, then how to do it. */}
      {data.bodyEffect && (
        <div>
          <SectionTitle>What it trains</SectionTitle>
          <Card className="px-4 py-3.5">
            <p className="text-text-2 text-[14px] leading-relaxed whitespace-pre-line">
              {data.bodyEffect}
            </p>
          </Card>
        </div>
      )}

      {data.secondaryMuscles.length > 0 && (
        <div>
          <SectionTitle>Also works</SectionTitle>
          <Card className="px-4 py-3">
            <p className="text-text-2 text-[14px]">
              {data.secondaryMuscles.map(labelize).join(" · ")}
            </p>
          </Card>
        </div>
      )}

      {data.instructions && (
        <div>
          <SectionTitle>How to do it</SectionTitle>
          <Card className="px-4 py-3.5">
            <p className="text-text-2 text-[14px] leading-relaxed whitespace-pre-line">
              {data.instructions}
            </p>
          </Card>
        </div>
      )}

      {!data.bodyEffect && !data.instructions && (
        <EmptyState
          icon={Info}
          title="No notes yet"
          body="Custom exercises start blank — edit it to add your own setup and cues."
        />
      )}

      {/* Grayscale, not volt: a link out isn't state that matters. The label
          never calls a search a demonstration — see lib/exercise-video.ts. */}
      <div>
        <SectionTitle>Form</SectionTitle>
        <Card className="overflow-hidden">
          <a
            href={data.video.href}
            target="_blank"
            rel="noreferrer noopener"
            className="press flex items-center gap-3 px-4 py-3"
          >
            <span className="bg-surface-3 grid size-11 shrink-0 place-items-center rounded-lg">
              <Play className="text-text-2 size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">
                {data.video.curated ? "Watch the form" : "Find a form demo"}
              </span>
              <span className="text-text-3 block text-[12px]">
                {data.video.curated
                  ? "Opens YouTube"
                  : "Searches YouTube for this exercise"}
              </span>
            </span>
            <ExternalLink className="text-text-3 size-4 shrink-0" />
          </a>
        </Card>
      </div>

      {data.alternatives.length > 0 && (
        <div>
          <SectionTitle>Alternatives</SectionTitle>
          <Card className="divide-hairline divide-y overflow-hidden">
            {data.alternatives.map((a) => (
              <Link
                key={a.id}
                href={`/exercises/${a.id}`}
                // items-start, not items-center: the note makes these rows
                // three lines tall and a centred chevron reads as misaligned.
                className="press flex items-start gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{a.name}</p>
                  <p className="text-text-3 truncate text-[12px]">
                    {labelize(a.primaryMuscle)} · {labelize(a.equipment)}
                  </p>
                  <p className="text-text-2 mt-1.5 text-[13px] leading-relaxed">
                    {a.note}
                  </p>
                </div>
                <ChevronRight className="text-text-3 mt-0.5 size-4 shrink-0" />
              </Link>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * The same panel, fetching its own data, for a sheet opened from somewhere that
 * has an exercise id and nothing else.
 *
 * Results are kept per id for the life of the component rather than refetched
 * per open: building a routine means opening several of these, often the same
 * one twice, and every miss is a round trip to a database that may have scaled
 * to zero since the last one.
 */
export function ExerciseAboutSheetBody({ exerciseId }: { exerciseId: string }) {
  const cache = useRef(new Map<string, ExerciseAboutSheetData | null>());
  const [data, setData] = useState<ExerciseAboutSheetData | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let live = true;
    // Resolved rather than read during render: a cached entry still arrives
    // through the same setState, one frame of skeleton later. `undefined` is
    // "still loading" and `null` is "there is nothing to show", so a miss
    // leaves `data` undefined rather than showing the previous exercise's
    // prose under the new exercise's title.
    const hit = cache.current.get(exerciseId);
    if (hit !== undefined) {
      setData(hit);
      return;
    }
    setData(undefined);
    getExerciseAboutAction(exerciseId).then((result) => {
      cache.current.set(exerciseId, result);
      if (live) setData(result);
    });
    return () => {
      live = false;
    };
  }, [exerciseId]);

  if (data === undefined) {
    return (
      <div className="space-y-4 px-4 pb-5">
        <Skeleton className="h-5 w-28 rounded-md" />
        <Skeleton className="h-28 rounded-[12px]" />
        <Skeleton className="h-20 rounded-[12px]" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="px-4 pb-5">
        <EmptyState
          icon={Info}
          title="Couldn't load this exercise"
          body="It may have been archived or removed. Close and try again."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-5">
      {/* The sheet title is the name and nothing else, so the muscle and
          equipment the action already returns would otherwise be dropped —
          the page shows them as its NavBar subtitle. */}
      <p className="text-text-3 -mt-1 text-[13px]">
        {labelize(data.primaryMuscle)} · {labelize(data.equipment)}
      </p>

      {/* Why this exercise behaves differently from the rest of the library.
          Adopting has no server render to refresh here — the routine on screen
          is unsaved React state — so the cached entry is rewritten and the
          strip drops locally. */}
      <ExerciseStateStrips
        exerciseId={exerciseId}
        archived={data.archived}
        imported={data.imported}
        onAdopted={() => {
          const adopted = { ...data, imported: false };
          cache.current.set(exerciseId, adopted);
          setData(adopted);
        }}
      />

      <ExerciseAbout data={data} />
    </div>
  );
}
