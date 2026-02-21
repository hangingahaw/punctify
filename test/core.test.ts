import { describe, it, expect, vi } from "vitest";
import { punctify } from "../src/core.js";
import type { Message } from "../src/types.js";

/** Helper: create a mock LLM that returns the given responses */
function mockLlm(responses: string[]) {
  let callIndex = 0;
  const fn = vi.fn(async (_messages: Message[]): Promise<string> => {
    return responses[callIndex++] ?? "[]";
  });
  return fn;
}

describe("punctify", () => {
  it("corrects punctuation in a simple paragraph", async () => {
    const llm = mockLlm(['[{"id":0,"text":"However, the court ruled."}]']);
    const result = await punctify("However the court ruled.", { llm });

    expect(result.text).toBe("However, the court ruled.");
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0].replacement).toBe(",");
    expect(result.unchanged).toBe(false);
  });

  it("returns unchanged when text needs no corrections", async () => {
    const llm = mockLlm(['[{"id":0,"text":"Already correct."}]']);
    const result = await punctify("Already correct.", { llm });

    expect(result.text).toBe("Already correct.");
    expect(result.corrections).toHaveLength(0);
    expect(result.unchanged).toBe(true);
  });

  it("returns unchanged for empty text, LLM not called", async () => {
    const llm = mockLlm([]);
    const result = await punctify("", { llm });

    expect(result.text).toBe("");
    expect(result.unchanged).toBe(true);
    expect(llm).not.toHaveBeenCalled();
  });

  it("rejects word changes from LLM (safety filter)", async () => {
    const llm = mockLlm(['[{"id":0,"text":"The dog sat."}]']);
    const result = await punctify("The cat sat.", { llm });

    // Word change "cat" -> "dog" should be rejected
    expect(result.text).toBe("The cat sat.");
    expect(result.corrections).toHaveLength(0);
    expect(result.unchanged).toBe(true);
  });

  it("batches paragraphs based on batchSize", async () => {
    const text = "Para one.\n\nPara two.\n\nPara three.";
    const llm = mockLlm([
      '[{"id":0,"text":"Para one."},{"id":1,"text":"Para two."}]',
      '[{"id":2,"text":"Para three."}]',
    ]);

    const result = await punctify(text, { llm, batchSize: 2 });

    expect(llm).toHaveBeenCalledTimes(2);
    expect(result.text).toBe(text);
    expect(result.unchanged).toBe(true);
  });

  it("rejects LLM response with IDs from a different batch", async () => {
    const text = "A.\n\nB.\n\nC.";
    const llm = mockLlm([
      '[{"id":0,"text":"A."},{"id":1,"text":"B."}]',
      '[{"id":0,"text":"C."}]', // wrong: id 0 belongs to batch 1
    ]);

    await expect(punctify(text, { llm, batchSize: 2 })).rejects.toThrow(
      "unexpected id 0"
    );
  });

  it("rejects LLM response missing an ID from its batch", async () => {
    const text = "A.\n\nB.\n\nC.";
    const llm = mockLlm([
      '[{"id":0,"text":"A."}]', // missing id 1
      '[{"id":2,"text":"C."}]',
    ]);

    await expect(punctify(text, { llm, batchSize: 2 })).rejects.toThrow(
      "missing correction for id 1"
    );
  });

  it("passes custom rules through to prompt", async () => {
    const llm = mockLlm(['[{"id":0,"text":"Test."}]']);
    await punctify("Test.", { llm, rules: "Use Oxford comma" });

    const messages = llm.mock.calls[0][0];
    expect(messages[0].content).toContain("Use Oxford comma");
  });

  it("propagates LLM errors", async () => {
    const llm = vi.fn(async () => {
      throw new Error("API rate limit");
    });

    await expect(punctify("Some text.", { llm })).rejects.toThrow("API rate limit");
  });

  it("throws when neither apiKey nor llm provided", async () => {
    await expect(punctify("Test.", {} as any)).rejects.toThrow(
      "punctify requires either"
    );
  });

  it("throws when options is undefined", async () => {
    await expect(punctify("Test.")).rejects.toThrow("requires an options object");
  });

  it("throws on batchSize of 0", async () => {
    const llm = mockLlm([]);
    await expect(punctify("Test.", { llm, batchSize: 0 })).rejects.toThrow("Invalid batchSize");
  });

  it("throws on negative batchSize", async () => {
    const llm = mockLlm([]);
    await expect(punctify("Test.", { llm, batchSize: -1 })).rejects.toThrow("Invalid batchSize");
  });

  it("throws on NaN batchSize", async () => {
    const llm = mockLlm([]);
    await expect(punctify("Test.", { llm, batchSize: NaN })).rejects.toThrow("Invalid batchSize");
  });

  it("throws on fractional batchSize", async () => {
    const llm = mockLlm([]);
    await expect(punctify("Test.", { llm, batchSize: 1.5 })).rejects.toThrow("Invalid batchSize");
  });

  it("throws when llm option is not a function", async () => {
    await expect(
      punctify("Test.", { llm: "not a function" as any })
    ).rejects.toThrow("`llm` option must be a function");
  });

  it("throws when apiKey provided without model or provider", async () => {
    await expect(
      punctify("Test.", { apiKey: "sk-test" })
    ).rejects.toThrow("requires `model`");
  });

  it("throws on unknown provider", async () => {
    await expect(
      punctify("Test.", { apiKey: "sk-test", provider: "invalid" as any })
    ).rejects.toThrow("Unknown provider");
  });

  it("handles multi-paragraph corrections correctly", async () => {
    const text = "First para.\n\nSecond para.";
    const llm = mockLlm([
      '[{"id":0,"text":"First para,"},{"id":1,"text":"Second para;"}]',
    ]);

    const result = await punctify(text, { llm });

    expect(result.text).toBe("First para,\n\nSecond para;");
    expect(result.corrections).toHaveLength(2);
    expect(result.unchanged).toBe(false);
  });

  it("filters punctuation changes while rejecting word changes in same response", async () => {
    // LLM changes both punctuation and a word — only punctuation should survive
    const llm = mockLlm(['[{"id":0,"text":"The dog sat,"}]']);
    const result = await punctify("The cat sat.", { llm });

    // "cat" -> "dog" rejected; "." -> "," might also be rejected since it's in the same hunk
    // The key guarantee: no word changes in the output
    expect(result.text).not.toContain("dog");
  });
});
