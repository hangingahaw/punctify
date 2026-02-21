import { describe, it, expect } from "vitest";
import { parseResponse, applyCorrections } from "../src/replacer.js";
import type { Paragraph } from "../src/types.js";

describe("parseResponse", () => {
  it("parses clean JSON array", () => {
    const result = parseResponse('[{"id":0,"text":"Hello, world."}]');
    expect(result).toEqual([{ id: 0, text: "Hello, world." }]);
  });

  it("parses fenced JSON", () => {
    const result = parseResponse('```json\n[{"id":0,"text":"Fixed."}]\n```');
    expect(result).toEqual([{ id: 0, text: "Fixed." }]);
  });

  it("handles extra whitespace", () => {
    const result = parseResponse('  \n  [{"id":0,"text":"ok"}]  \n  ');
    expect(result).toEqual([{ id: 0, text: "ok" }]);
  });

  it("extracts JSON array from surrounding text", () => {
    const result = parseResponse('Here is the result: [{"id":0,"text":"ok"}] Hope this helps!');
    expect(result).toEqual([{ id: 0, text: "ok" }]);
  });

  it("skips non-array brackets before the actual JSON array", () => {
    const result = parseResponse(
      'Here is [my analysis] of the text: [{"id":0,"text":"ok"}]'
    );
    expect(result).toEqual([{ id: 0, text: "ok" }]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseResponse("{not valid}")).toThrow("no JSON array found");
  });

  it("throws on non-array JSON", () => {
    expect(() => parseResponse('{"id":0}')).toThrow("no JSON array found");
  });

  it("throws on malformed array items (missing text)", () => {
    expect(() => parseResponse('[{"id":0}]')).toThrow("Invalid correction");
  });

  it("throws on malformed array items (string id)", () => {
    expect(() => parseResponse('[{"id":"zero","text":"ok"}]')).toThrow("Invalid correction");
  });

  it("throws on empty response", () => {
    expect(() => parseResponse("")).toThrow("no JSON array found");
  });

  it("rejects duplicate correction IDs", () => {
    expect(() =>
      parseResponse('[{"id":0,"text":"a"},{"id":0,"text":"b"}]')
    ).toThrow("Duplicate correction id 0");
  });

  it("parses multiple items", () => {
    const result = parseResponse('[{"id":0,"text":"A"},{"id":1,"text":"B"},{"id":2,"text":"C"}]');
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(0);
    expect(result[1].id).toBe(1);
    expect(result[2].id).toBe(2);
  });
});

describe("applyCorrections", () => {
  const makeParagraph = (id: number, text: string, start: number): Paragraph => ({
    id,
    text,
    start,
    end: start + text.length,
  });

  it("applies a punctuation-only correction", () => {
    const text = "However the court ruled.";
    const paragraphs = [makeParagraph(0, text, 0)];
    const corrections = [{ id: 0, text: "However, the court ruled." }];

    const result = applyCorrections(text, paragraphs, corrections);
    expect(result.text).toBe("However, the court ruled.");
    expect(result.appliedCorrections).toHaveLength(1);
    expect(result.appliedCorrections[0].replacement).toBe(",");
  });

  it("rejects word changes from LLM", () => {
    const text = "The cat sat.";
    const paragraphs = [makeParagraph(0, text, 0)];
    const corrections = [{ id: 0, text: "The dog sat." }];

    const result = applyCorrections(text, paragraphs, corrections);
    // Word change should be rejected by differ
    expect(result.text).toBe("The cat sat.");
    expect(result.appliedCorrections).toHaveLength(0);
  });

  it("returns unchanged text when correction matches original", () => {
    const text = "Already correct.";
    const paragraphs = [makeParagraph(0, text, 0)];
    const corrections = [{ id: 0, text: "Already correct." }];

    const result = applyCorrections(text, paragraphs, corrections);
    expect(result.text).toBe(text);
    expect(result.appliedCorrections).toHaveLength(0);
  });

  it("handles multi-paragraph text with separators", () => {
    const text = "First para.\n\nSecond para.";
    const paragraphs = [
      makeParagraph(0, "First para.", 0),
      makeParagraph(1, "Second para.", 13),
    ];
    const corrections = [
      { id: 0, text: "First para," },
      { id: 1, text: "Second para;" },
    ];

    const result = applyCorrections(text, paragraphs, corrections);
    expect(result.text).toBe("First para,\n\nSecond para;");
    expect(result.appliedCorrections).toHaveLength(2);
  });

  it("throws when a paragraph has no matching correction", () => {
    const text = "Paragraph one.";
    const paragraphs = [makeParagraph(0, text, 0)];
    // Empty corrections array — missing id 0
    const corrections: { id: number; text: string }[] = [];

    expect(() => applyCorrections(text, paragraphs, corrections)).toThrow(
      "Missing correction for paragraph id 0"
    );
  });

  it("throws on unknown correction IDs", () => {
    const text = "Paragraph one.";
    const paragraphs = [makeParagraph(0, text, 0)];
    const corrections = [
      { id: 0, text: "Paragraph one." },
      { id: 99, text: "Ghost." },
    ];

    expect(() => applyCorrections(text, paragraphs, corrections)).toThrow(
      "Unknown correction id 99"
    );
  });

  it("applies corrections end-to-start preserving indices", () => {
    // Two paragraphs where both need fixes
    const text = "A.\n\nB.";
    const paragraphs = [
      makeParagraph(0, "A.", 0),
      makeParagraph(1, "B.", 4),
    ];
    const corrections = [
      { id: 0, text: "A," },
      { id: 1, text: "B;" },
    ];

    const result = applyCorrections(text, paragraphs, corrections);
    expect(result.text).toBe("A,\n\nB;");
  });
});
