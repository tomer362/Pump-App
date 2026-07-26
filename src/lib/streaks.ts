/**
 * Descending list of training days → current and best consecutive-day runs.
 *
 * Pure and separate from the query so it can be tested: streaks are all edge
 * cases (a rest day today, a gap of exactly one, a single day, an empty
 * history) and none of them are reachable by clicking around.
 *
 * `today` is a parameter rather than `new Date()` so a test can pin it.
 */
export function streaks(
  daysDesc: Date[],
  now: Date = new Date(),
): { current: number; longest: number } {
  if (!daysDesc.length) return { current: 0, longest: 0 };
  const DAY = 86_400_000;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < daysDesc.length; i++) {
    const gap = Math.round(
      (daysDesc[i - 1].getTime() - daysDesc[i].getTime()) / DAY,
    );
    if (gap === 1) {
      run++;
      longest = Math.max(longest, run);
    } else if (gap > 1) {
      run = 1;
    }
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const gapFromToday = Math.round(
    (today.getTime() - daysDesc[0].getTime()) / DAY,
  );

  let current = 0;
  // A rest day today shouldn't zero the streak until tomorrow.
  if (gapFromToday <= 1) {
    current = 1;
    for (let i = 1; i < daysDesc.length; i++) {
      const gap = Math.round(
        (daysDesc[i - 1].getTime() - daysDesc[i].getTime()) / DAY,
      );
      if (gap === 1) current++;
      else break;
    }
  }

  return { current, longest };
}
