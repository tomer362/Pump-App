import { describe, expect, it } from "vitest";
import { EQUIPMENT, MUSCLES, SET_TYPES, TRACKING_TYPES } from "@/lib/db/schema";
import { buildRoutinePrompt, PROMPT_EXAMPLE } from "@/lib/routine-prompt";
import {
  parseRoutineExport,
  ROUTINE_FORMAT,
  ROUTINE_FORMAT_VERSION,
  serializeRoutineExport,
  stripCodeFence,
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

  it("converts the plan in the chat rather than writing a new one", () => {
    const prompt = buildRoutinePrompt();
    expect(prompt).toContain("already given me in this conversation");
    expect(prompt).toContain("Do not design a new plan");
    // The old tail asked the person to type their goal into the prompt. Left
    // in, it invites the model to start over from a blank sheet.
    expect(prompt).not.toContain("The routine I want:");
  });

  it("asks for one fenced document per training day", () => {
    const prompt = buildRoutinePrompt();
    expect(prompt).toContain("One document per routine");
    expect(prompt).toContain("```json");
    expect(prompt).toContain("Never merge two days into one document");
    expect(prompt).toContain("never wrap the documents in a JSON array");
    // Reversed deliberately when the prompt started emitting several
    // documents: the fence is what puts a copy button on each one.
    expect(prompt).not.toContain("no markdown code fence");
  });
});

/**
 * The paste path is the other half of the fenced-block decision. What reaches
 * it depends on how the person copied: the code block's own button, a hand
 * selection that caught the fence, or the whole reply.
 */
describe("pasting what a model replied", () => {
  const doc = serializeRoutineExport(PROMPT_EXAMPLE);

  it("accepts a bare document — the file path is unchanged", () => {
    expect(parseRoutineExport(doc).ok).toBe(true);
    expect(stripCodeFence(doc).blocks).toBe(0);
  });

  it("accepts one fenced block, label line and all", () => {
    const pasted = `Day 1 — Upper A\n\n\`\`\`json\n${doc}\n\`\`\`\n`;
    expect(stripCodeFence(pasted).blocks).toBe(1);
    const res = parseRoutineExport(pasted);
    expect(res.ok).toBe(true);
    expect(res.ok && res.doc.routine.name).toBe(PROMPT_EXAMPLE.routine.name);
  });

  it("tells someone who pasted the whole week to go one at a time", () => {
    const pasted = [
      "Day 1 — Upper A",
      `\`\`\`json\n${doc}\n\`\`\``,
      "Day 2 — Lower A",
      `\`\`\`json\n${doc}\n\`\`\``,
    ].join("\n\n");
    expect(stripCodeFence(pasted).blocks).toBe(2);
    const res = parseRoutineExport(pasted);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/one at a time/);
  });

  it("still says 'not valid JSON' for prose with no document in it", () => {
    const res = parseRoutineExport("Sure! Here is your routine:");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/valid JSON/);
  });

  it("never reinterprets a document whose own text contains a fence", () => {
    // Notes are free text. A file that parses as JSON must parse as itself,
    // which is why the fence fallback only runs after JSON.parse has failed.
    const withFence = serializeRoutineExport({
      ...PROMPT_EXAMPLE,
      routine: {
        ...PROMPT_EXAMPLE.routine,
        notes: "Warm up like this:\n```\nempty bar x 10\n```",
      },
    });
    const res = parseRoutineExport(withFence);
    expect(res.ok).toBe(true);
    expect(res.ok && res.doc.routine.notes).toContain("empty bar x 10");
  });
});
