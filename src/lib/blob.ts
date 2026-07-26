import "server-only";

/**
 * Photo upload is optional. Without a Vercel Blob store the app simply
 * doesn't offer it — the same posture as web push, so a deployment that
 * hasn't wired up storage still works end to end rather than erroring at the
 * moment someone taps "add a photo".
 */
export function uploadsEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * The client downscales to roughly 200 KB before uploading; this is the
 * backstop against a caller that doesn't. Kept small deliberately — Blob's
 * free allowance is shared across every user of the deployment.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Every URL that reaches a write action is caller-supplied — the client
 * uploads directly and then hands back what it got. Without this check the
 * "save my avatar" action would happily store any remote URL, which is an
 * SSRF-shaped hole for whatever later fetches it and a way to render an
 * arbitrary image under someone else's name.
 */
export function isBlobUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
