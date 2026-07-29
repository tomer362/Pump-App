import { auth } from "@/lib/auth";

/**
 * Better Auth routes internally on the request URL's *pathname* — it strips
 * `/api/auth` and matches the rest against its endpoint table. That makes it
 * dependent on the pathname surviving the trip from the browser intact, and
 * on Vercel it does not always: a catch-all route can be invoked with the
 * rewritten internal form of the URL rather than the one the client asked
 * for, with the real segments carried alongside as `nxtPall`. Better Auth
 * then matches nothing and answers 404 with an empty body — which is exactly
 * the failure `POST /api/auth/sign-in/social` was returning in production
 * while working locally.
 *
 * `params` is Next's own authoritative record of the matched segments, so
 * rebuild the pathname from it and hand Better Auth a request whose URL says
 * what the client actually requested. When the pathname already agrees — the
 * normal case, including `next dev` and `next start` — this is a no-op and
 * the original request is passed straight through untouched.
 */
async function handler(
  req: Request,
  ctx: { params: Promise<{ all: string[] }> },
) {
  const { all } = await ctx.params;
  const url = new URL(req.url);
  const expected = `/api/auth/${all.map(encodeURIComponent).join("/")}`;

  if (url.pathname === expected) return auth.handler(req);

  // Loud on purpose: if this ever fires it is the platform rewriting paths
  // underneath us, and the next person to debug a 404 here should not have to
  // rediscover it.
  console.warn(
    `[pump] auth path rewritten by the platform: got "${url.pathname}", ` +
      `routing as "${expected}"`,
  );

  url.pathname = expected;
  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.arrayBuffer();

  return auth.handler(
    new Request(url, { method: req.method, headers: req.headers, body }),
  );
}

export const GET = handler;
export const POST = handler;
