import { describe, it, expect } from "vitest";
import { splitParagraphs } from "../src/splitter.js";

describe("splitParagraphs", () => {
  it("splits text on double newlines", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 0, text: "First paragraph.", start: 0, end: 16 });
    expect(result[1]).toEqual({ id: 1, text: "Second paragraph.", start: 18, end: 35 });
  });

  it("splits on triple newlines", () => {
    const text = "Para one.\n\n\nPara two.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 0, text: "Para one.", start: 0, end: 9 });
    expect(result[1]).toEqual({ id: 1, text: "Para two.", start: 12, end: 21 });
  });

  it("handles single paragraph (no separator)", () => {
    const text = "Just one paragraph.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 0, text: "Just one paragraph.", start: 0, end: 19 });
  });

  it("returns empty array for empty string", () => {
    expect(splitParagraphs("")).toEqual([]);
  });

  it("preserves separator positions for lossless reassembly", () => {
    const text = "A\n\nB\n\n\nC";
    const paragraphs = splitParagraphs(text);

    // Reassemble by slicing separators from original text
    let reassembled = "";
    for (let i = 0; i < paragraphs.length; i++) {
      if (i > 0) {
        // Separator is the slice between previous end and current start
        reassembled += text.slice(paragraphs[i - 1].end, paragraphs[i].start);
      }
      reassembled += paragraphs[i].text;
    }
    expect(reassembled).toBe(text);
  });

  it("handles text with single newlines (no split)", () => {
    const text = "Line one.\nLine two.\nLine three.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(text);
  });

  it("handles multiple paragraphs", () => {
    const text = "One.\n\nTwo.\n\nThree.\n\nFour.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(4);
    expect(result[0].text).toBe("One.");
    expect(result[1].text).toBe("Two.");
    expect(result[2].text).toBe("Three.");
    expect(result[3].text).toBe("Four.");
  });

  it("assigns sequential IDs", () => {
    const text = "A\n\nB\n\nC";
    const result = splitParagraphs(text);

    expect(result.map((p) => p.id)).toEqual([0, 1, 2]);
  });

  it("handles trailing double newlines", () => {
    const text = "Content.\n\n";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Content.");
  });

  it("handles leading double newlines", () => {
    const text = "\n\nContent.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Content.");
  });

  it("handles paragraphs with internal single newlines", () => {
    const text = "Line 1\nLine 2\n\nLine 3\nLine 4";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Line 1\nLine 2");
    expect(result[1].text).toBe("Line 3\nLine 4");
  });

  it("splits on CRLF double newlines and maps positions to original text", () => {
    const text = "First paragraph.\r\n\r\nSecond paragraph.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(2);
    // Paragraph text should have \r\n normalized to \n
    expect(result[0].text).toBe("First paragraph.");
    expect(result[1].text).toBe("Second paragraph.");

    // Positions should map to the *original* text
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(16);
    // The separator \r\n\r\n is 4 chars, so second paragraph starts at 20
    expect(result[1].start).toBe(20);
    expect(result[1].end).toBe(text.length); // 37

    // Verify slicing the original text at these positions works
    expect(text.slice(result[0].start, result[0].end)).toBe("First paragraph.");
    expect(text.slice(result[1].start, result[1].end)).toBe("Second paragraph.");
  });

  it("handles mixed CRLF and LF line endings", () => {
    const text = "Para A.\r\n\r\nPara B.\n\nPara C.";
    const result = splitParagraphs(text);

    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("Para A.");
    expect(result[1].text).toBe("Para B.");
    expect(result[2].text).toBe("Para C.");

    // Verify original slicing works for all paragraphs
    expect(text.slice(result[0].start, result[0].end)).toBe("Para A.");
    expect(text.slice(result[1].start, result[1].end)).toBe("Para B.");
    expect(text.slice(result[2].start, result[2].end)).toBe("Para C.");
  });

  it("preserves separator positions for lossless reassembly with CRLF", () => {
    const text = "A\r\n\r\nB\r\n\r\n\r\nC";
    const paragraphs = splitParagraphs(text);

    expect(paragraphs).toHaveLength(3);

    // Reassemble by slicing separators from original text
    let reassembled = "";
    for (let i = 0; i < paragraphs.length; i++) {
      if (i > 0) {
        reassembled += text.slice(paragraphs[i - 1].end, paragraphs[i].start);
      }
      reassembled += text.slice(paragraphs[i].start, paragraphs[i].end);
    }
    expect(reassembled).toBe(text);
  });
});
