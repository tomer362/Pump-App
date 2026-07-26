"use server";

import { getCurrentUser } from "@/lib/session";
import { searchPeople, type PersonCard } from "@/lib/queries/social";

/** Client-callable people search, so the query module stays `server-only`. */
export async function searchPeopleAction(query: string): Promise<PersonCard[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  return searchPeople(me.id, query, 25);
}
