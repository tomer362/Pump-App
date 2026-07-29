/**
 * Form-demo links for exercises.
 *
 * Curated video ids are hand-picked for the movements people log most; the
 * long tail falls back to a YouTube *search*. The fallback is labelled as a
 * search everywhere it renders — dressing a results page up as a vetted
 * demonstration is the one thing that would make it dishonest, and the
 * alternative (hand-authoring hundreds of ids with no liveness check, since
 * verifying one means an HTTP call per render) is a link-rot surface we have
 * no way to detect.
 */

export type VideoLink = {
  href: string;
  /** True when the link points at a specific vetted video, not a search. */
  curated: boolean;
};

export function exerciseVideoLink(ex: {
  name: string;
  videoUrl: string | null;
}): VideoLink {
  if (ex.videoUrl) return { href: ex.videoUrl, curated: true };
  const q = encodeURIComponent(`${ex.name} proper form`);
  return {
    href: `https://www.youtube.com/results?search_query=${q}`,
    curated: false,
  };
}

/** Build the canonical watch URL the seed stores from an 11-char video id. */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

/**
 * Strict allowlist for anything that could reach an `<a href>`. Parses with
 * `URL` rather than matching the raw string — a regex over raw input is how
 * `javascript:` and `https://youtube.com.evil.test/` slip through.
 *
 * Nothing user-supplied writes `exercise.videoUrl` today; this exists so that
 * if a "paste a form video" control is ever added to `createCustomExercise`,
 * the validator is already here and already tested.
 */
export function isYouTubeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "youtu.be") return VIDEO_ID.test(u.pathname.slice(1));
  if (WATCH_HOSTS.has(host)) {
    return u.pathname === "/watch" && VIDEO_ID.test(u.searchParams.get("v") ?? "");
  }
  return false;
}
