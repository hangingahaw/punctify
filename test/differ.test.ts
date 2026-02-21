import { describe, it, expect } from "vitest";
import { diffParagraph } from "../src/differ.js";

describe("diffParagraph", () => {
  it("returns empty array when texts are identical", () => {
    expect(diffParagraph("Hello, world.", "Hello, world.", 0)).toEqual([]);
  });

  it("accepts comma insertion (punctuation-only change)", () => {
    const result = diffParagraph(
      "However the court ruled",
      "However, the court ruled",
      0
    );

    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("");
    expect(result[0].replacement).toBe(",");
    expect(result[0].position).toBe(7);
  });

  it("accepts comma removal", () => {
    const result = diffParagraph(
      "The, cat sat",
      "The cat sat",
      0
    );

    expect(result).toHaveLength(1);
    expect(result[0].original).toBe(",");
    expect(result[0].replacement).toBe("");
  });

  it("accepts period to semicolon replacement", () => {
    const result = diffParagraph(
      "First clause. second clause",
      "First clause; second clause",
      0
    );

    expect(result).toHaveLength(1);
    expect(result[0].original).toBe(".");
    expect(result[0].replacement).toBe(";");
  });

  it("rejects word changes", () => {
    const result = diffParagraph(
      "The cat sat on the mat",
      "The dog sat on the mat",
      0
    );

    expect(result).toHaveLength(0);
  });

  it("rejects capitalization changes", () => {
    const result = diffParagraph(
      "the court ruled",
      "The court ruled",
      0
    );

    expect(result).toHaveLength(0);
  });

  it("rejects spacing changes", () => {
    const result = diffParagraph(
      "word  word",
      "word word",
      0
    );

    expect(result).toHaveLength(0);
  });

  it("accepts punctuation changes but rejects word changes in mixed diff", () => {
    const result = diffParagraph(
      "The cat sat. The dog ran",
      "The dog sat, The dog ran",
      0
    );

    // "cat" -> "dog" should be rejected
    // "." -> "," should be accepted (if it's a separate hunk)
    // The exact result depends on how diff-match-patch splits hunks
    for (const correction of result) {
      // Every accepted correction should be punctuation-only
      expect(correction.original).not.toMatch(/[\p{L}\p{N}]/u);
      expect(correction.replacement).not.toMatch(/[\p{L}\p{N}]/u);
    }
  });

  it("applies paragraph start offset to positions", () => {
    const result = diffParagraph(
      "Hello world",
      "Hello, world",
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].position).toBe(105);
  });

  it("accepts quote style changes", () => {
    const result = diffParagraph(
      'He said "hello"',
      'He said \u201chello\u201d',
      0
    );

    expect(result.length).toBeGreaterThan(0);
    // All corrections should be punctuation-only
    for (const c of result) {
      expect(c.original).not.toMatch(/[\p{L}\p{N}\s]/u);
      expect(c.replacement).not.toMatch(/[\p{L}\p{N}\s]/u);
    }
  });

  it("accepts apostrophe correction", () => {
    const result = diffParagraph(
      "it's fine",
      "it\u2019s fine",
      0
    );

    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("'");
    expect(result[0].replacement).toBe("\u2019");
  });

  it("accepts multiple punctuation changes in one paragraph", () => {
    const result = diffParagraph(
      "First. Second. Third",
      "First, Second; Third",
      0
    );

    expect(result).toHaveLength(2);
    expect(result[0].original).toBe(".");
    expect(result[0].replacement).toBe(",");
    expect(result[1].original).toBe(".");
    expect(result[1].replacement).toBe(";");
  });

  it("includes context in correction", () => {
    const result = diffParagraph(
      "However the court ruled",
      "However, the court ruled",
      0
    );

    expect(result).toHaveLength(1);
    expect(result[0].context).toContain("\u2192");
  });

  it("rejects digit changes", () => {
    const result = diffParagraph(
      "Section 101",
      "Section 102",
      0
    );

    expect(result).toHaveLength(0);
  });

  it("rejects symbol replacement ($ to €)", () => {
    const result = diffParagraph(
      "Price is $100",
      "Price is €100",
      0
    );

    expect(result).toHaveLength(0);
  });

  it("rejects emoji insertion", () => {
    const result = diffParagraph(
      "Great job",
      "Great job \uD83D\uDE00",
      0
    );

    expect(result).toHaveLength(0);
  });

  it("rejects symbol-only changes (# to @)", () => {
    const result = diffParagraph(
      "tag #foo",
      "tag @foo",
      0
    );

    expect(result).toHaveLength(0);
  });

  it("rejects currency symbol insertion", () => {
    const result = diffParagraph(
      "Total: 500",
      "Total: $500",
      0
    );

    expect(result).toHaveLength(0);
  });
});
