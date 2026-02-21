import type { ApplyResult, ParagraphCorrection, Paragraph, PunctCorrection } from "./types.js";
import { diffParagraph } from "./differ.js";

/**
 * Parse the LLM response into an array of ParagraphCorrection objects.
 *
 * Parsing strategy (in order):
 * 1. Strict JSON.parse on the full cleaned response
 * 2. Bracket extraction: try each `[` position left-to-right paired with
 *    the last `]`, stop at first valid JSON array parse
 */
export function parseResponse(response: string): ParagraphCorrection[] {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  cleaned = cleaned.trim();

  // Try strict JSON.parse first (handles clean responses)
  let parsed: unknown;
  try {
    const strict = JSON.parse(cleaned);
    if (Array.isArray(strict)) {
      parsed = strict;
    }
  } catch {
    // Not valid JSON — fall through to bracket extraction
  }

  // Fallback: try each [ position from left, paired with last ]
  if (parsed === undefined) {
    const end = cleaned.lastIndexOf("]");
    if (end === -1) {
      throw new Error(`Invalid LLM response: no JSON array found. Response: ${cleaned.slice(0, 200)}`);
    }

    for (let i = 0; i < end; i++) {
      if (cleaned[i] !== "[") continue;
      try {
        const candidate = JSON.parse(cleaned.slice(i, end + 1));
        if (Array.isArray(candidate)) {
          parsed = candidate;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      parsed === undefined
        ? `Invalid LLM response: no JSON array found. Response: ${cleaned.slice(0, 200)}`
        : "LLM response is not a JSON array"
    );
  }

  // Validate and extract each item
  const seenIds = new Set<number>();
  return parsed.map((item: unknown, idx: number) => {
    const rec = item as Record<string, unknown> | null;
    if (typeof rec !== "object" || rec === null || typeof rec.id !== "number" || typeof rec.text !== "string") {
      throw new Error(`Invalid correction at index ${idx}: ${JSON.stringify(item)}`);
    }

    const correction: ParagraphCorrection = { id: rec.id as number, text: rec.text as string };

    // Check for duplicate IDs
    if (seenIds.has(correction.id)) {
      throw new Error(`Duplicate correction id ${correction.id} at index ${idx}`);
    }
    seenIds.add(correction.id);

    return correction;
  });
}

/**
 * Apply paragraph-level corrections to the original text.
 *
 * For each paragraph, diffs the original against the LLM-corrected version
 * using the differ module to filter out non-punctuation changes.
 * Applies corrections from end to start to preserve index integrity.
 */
export function applyCorrections(
  text: string,
  paragraphs: readonly Paragraph[],
  corrections: readonly ParagraphCorrection[]
): ApplyResult {
  // Map corrections by id for lookup
  const correctionMap = new Map<number, string>();
  for (const c of corrections) {
    correctionMap.set(c.id, c.text);
  }

  // Validate: every paragraph must have a correction
  const paragraphIds = new Set(paragraphs.map((p) => p.id));
  for (const id of paragraphIds) {
    if (!correctionMap.has(id)) {
      throw new Error(`Missing correction for paragraph id ${id}`);
    }
  }

  // Validate: no unknown correction IDs
  for (const id of correctionMap.keys()) {
    if (!paragraphIds.has(id)) {
      throw new Error(`Unknown correction id ${id}: no matching paragraph`);
    }
  }

  // Collect all punctuation-safe corrections across all paragraphs
  const allCorrections: PunctCorrection[] = [];

  for (const para of paragraphs) {
    const correctedText = correctionMap.get(para.id)!;
    if (correctedText === para.text) continue; // no change

    const paraCorrections = diffParagraph(para.text, correctedText, para.start);
    allCorrections.push(...paraCorrections);
  }

  if (allCorrections.length === 0) {
    return { text, appliedCorrections: [] };
  }

  // Sort by position descending so replacements don't shift indices
  allCorrections.sort((a, b) => b.position - a.position);

  let result = text;
  for (const correction of allCorrections) {
    result =
      result.slice(0, correction.position) +
      correction.replacement +
      result.slice(correction.position + correction.original.length);
  }

  // Return corrections in forward order (by position ascending)
  allCorrections.reverse();

  return { text: result, appliedCorrections: allCorrections };
}
