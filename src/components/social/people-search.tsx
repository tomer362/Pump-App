"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Card, Input } from "@/components/ui/primitives";
import { PersonRow } from "./person-row";
import { searchPeopleAction } from "@/lib/actions/people-search";
import type { PersonCard } from "@/lib/queries/social";

export function PeopleSearch() {
  const [query, setQuery] = useState("");
  // Results are keyed by the query they came from, so a stale response can
  // never paint under a newer query and an empty box needs no state reset.
  const [fetched, setFetched] = useState<{ q: string; rows: PersonCard[] } | null>(
    null,
  );
  const debounce = useRef<number | undefined>(undefined);

  const q = query.trim();
  const results = fetched?.q === q ? fetched.rows : [];
  const loading = Boolean(q) && fetched?.q !== q;

  useEffect(() => {
    if (!q) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      const rows = await searchPeopleAction(q);
      setFetched({ q, rows });
    }, 220);
    return () => window.clearTimeout(debounce.current);
  }, [q]);

  return (
    <div>
      <div className="relative">
        <Search className="text-text-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or @username"
          className="pl-9"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="text-text-3 absolute top-1/2 right-2 -translate-y-1/2 p-2"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {query.trim() && (
        <Card className="divide-hairline mt-3 divide-y overflow-hidden">
          {loading && results.length === 0 ? (
            <p className="text-text-3 py-6 text-center text-[14px]">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="text-text-3 py-6 text-center text-[14px]">
              Nobody matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            results.map((p) => <PersonRow key={p.id} person={p} />)
          )}
        </Card>
      )}
    </div>
  );
}
