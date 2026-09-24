export type Unit = "kg" | "lb";

/**
 * Regions whose gyms load in pounds: the US, and the two other countries that
 * never went metric. The UK is deliberately absent — bodyweight in stone,
 * but the plates on the bar are kilograms.
 */
const POUND_REGIONS = new Set(["US", "LR", "MM"]);

/**
 * The onboarding default for the weight unit, from a BCP 47 tag. `maximize()`
 * fills in the likely region, so a bare `en` resolves to `en-US` — which is
 * what a browser reporting only `en` almost always is.
 */
export function unitForLocale(tag: string): Unit {
  try {
    const region = new Intl.Locale(tag).maximize().region;
    return region && POUND_REGIONS.has(region) ? "lb" : "kg";
  } catch {
    return "kg";
  }
}

/** Client-only: read it through `useSyncExternalStore` with a server snapshot. */
export function guessUnit(): Unit {
  return unitForLocale(navigator.language);
}
