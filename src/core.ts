import { resolveLlm } from "@lexstyle/llm-client";
import type { ParagraphCorrection, PunctifyOptions, PunctifyResult } from "./types.js";
import { splitParagraphs } from "./splitter.js";
import { buildMessages } from "./prompt.js";
import { applyCorrections, parseResponse } from "./replacer.js";

/** Validate that a value is a finite integer >= min. */
function requireInt(value: number, name: string, min: number): void {
  if (!Number.isFinite(value) || value < min || Math.floor(value) !== value) {
    throw new Error(`Invalid ${name}: ${value}. Must be a finite integer >= ${min}.`);
  }
}

/**
 * Validate that a batch response contains exactly the expected IDs.
 */
function validateBatchIds(corrections: readonly ParagraphCorrection[], expectedIds: ReadonlySet<number>): void {
  for (const { id } of corrections) {
    if (!expectedIds.has(id)) {
      throw new Error(`LLM returned unexpected id ${id} (not in this batch)`);
    }
  }
  for (const id of expectedIds) {
    if (!corrections.some((c) => c.id === id)) {
      throw new Error(`LLM missing correction for id ${id} in batch`);
    }
  }
}

/**
 * Correct punctuation in text using an LLM.
 *
 * Architecture: split into paragraphs -> batch LLM calls -> diff + filter -> replace.
 * Only punctuation changes survive the safety filter.
 */
export async function punctify(
  text: string,
  options?: PunctifyOptions
): Promise<PunctifyResult> {
  if (!options || typeof options !== "object") {
    throw new Error("punctify requires an options object with `apiKey` + `model`, `apiKey` + `provider`, or `llm`");
  }

  const batchSize = options.batchSize ?? 10;
  requireInt(batchSize, "batchSize", 1);

  const llmFn = resolveLlm(options, "punctify");

  // Split text into paragraphs
  const paragraphs = splitParagraphs(text);

  if (paragraphs.length === 0) {
    return { text, corrections: [], unchanged: true };
  }

  // Chunk into batches and process sequentially
  const allCorrections: ParagraphCorrection[] = [];

  for (let i = 0; i < paragraphs.length; i += batchSize) {
    const batch = paragraphs.slice(i, i + batchSize);
    const messages = buildMessages(batch, options.rules);
    const response = await llmFn(messages);
    const corrections = parseResponse(response);

    validateBatchIds(corrections, new Set(batch.map((p) => p.id)));
    allCorrections.push(...corrections);
  }

  // Apply all corrections with punctuation-only safety filter
  const { text: correctedText, appliedCorrections } = applyCorrections(text, paragraphs, allCorrections);

  return {
    text: correctedText,
    corrections: appliedCorrections,
    unchanged: appliedCorrections.length === 0,
  };
}
