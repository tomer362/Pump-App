import { describe, expect, it } from "vitest";
import { EQUIPMENT, MUSCLES, SET_TYPES, TRACKING_TYPES } from "@/lib/db/schema";
import { buildRoutinePrompt, PROMPT_EXAMPLE } from "@/lib/routine-prompt";
import {
  parseRoutineExport,
  ROUTINE_FORMAT,
  ROUTINE_FORMAT_VERSION,
  serializeRoutineExport,
} from "@/lib/routine-transfer";

/**
 * The prompt is only worth copying if it is true, and it is exactly the kind of
 * text that rots silently: nothing else breaks the day a muscle or a set type
 * is added to the schema. No database here — the prompt module is pure.
 */
describe("routine prompt", () => {
  it("shows an example the importer actually accepts", () => {
    const res = parseRoutineExport(serializeRoutineExport(PROMPT_EXAMPLE));
    expect(res.ok).toBe(true);
  });

  it("embeds that example verbatim", () => {
    expect(buildRoutinePrompt()).toContain(
      serializeRoutineExport(PROMPT_EXAMPLE),
    );
  });

  it("lists every value of every enum the document can carry", () => {
    const prompt = buildRoutinePrompt();
    for (const value of [
      ...MUSCLES,
      ...EQUIPMENT,
      ...TRACKING_TYPES,
      ...SET_TYPES,
    ]) {
      expect(prompt, `missing enum value ${value}`).toContain(value);
    }
  });

  it("names the current format and version", () => {
    const prompt = buildRoutinePrompt();
    expect(prompt).toContain(ROUTINE_FORMAT);
    expect(prompt).toContain(String(ROUTINE_FORMAT_VERSION));
  });

  it("tells the model to leave slugs null", () => {
    // A slug is the one field an import trusts to bind to a built-in row, and
    // a model will happily invent one. The example has to model the rule too.
    expect(buildRoutinePrompt()).toContain('"slug" must be null');
    for (const e of PROMPT_EXAMPLE.routine.exercises) {
      expect(e.exercise.slug).toBeNull();
    }
  });
});
