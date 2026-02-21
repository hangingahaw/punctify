import DiffMatchPatch from "diff-match-patch";
import type { PunctCorrection } from "./types.js";

const dmp = new DiffMatchPatch();

/**
 * Explicit set of allowed punctuation characters.
 *
 * Periods, commas, semicolons, colons, question/exclamation marks,
 * straight and curly quotes, straight and curly apostrophes,
 * parentheses, brackets, braces, hyphens, en-dash, em-dash,
 * ellipsis, and slashes.
 */
const PUNCT_CHARS = new Set([
  ".", ",", ";", ":", "?", "!",
  '"', "'",                        // straight quotes / apostrophe
  "\u201C", "\u201D",              // curly double quotes  " "
  "\u2018", "\u2019",              // curly single quotes  ' '
  "(", ")", "[", "]", "{", "}",
  "-", "\u2013", "\u2014",         // hyphen, en-dash, em-dash
  "\u2026",                        // ellipsis …
  "/", "\\",
]);

/**
 * Check if a string contains ONLY allowed punctuation characters.
 */
function isPunctuationOnly(s: string): boolean {
  if (s.length === 0) return true;
  for (const ch of s) {
    if (!PUNCT_CHARS.has(ch)) return false;
  }
  return true;
}

// diff-match-patch doesn't export these as typed constants; define locally
const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;

/**
 * Diff a paragraph's original text against the LLM-corrected text.
 *
 * Returns only punctuation-safe corrections. Any diff hunk that changes
 * letters, digits, or whitespace is silently rejected (the LLM overstepped).
 *
 * @param original - The original paragraph text
 * @param corrected - The LLM-corrected paragraph text
 * @param paragraphStart - The paragraph's start offset in the full document
 * @returns Array of safe punctuation corrections
 */
export function diffParagraph(
  original: string,
  corrected: string,
  paragraphStart: number
): PunctCorrection[] {
  if (original === corrected) return [];

  const diffs = dmp.diff_main(original, corrected);
  dmp.diff_cleanupSemantic(diffs);

  const corrections: PunctCorrection[] = [];
  let pos = 0; // position in the original text (relative to paragraph)

  let i = 0;
  while (i < diffs.length) {
    const [op, text] = diffs[i];

    if (op === DIFF_EQUAL) {
      pos += text.length;
      i++;
      continue;
    }

    // Collect a contiguous delete+insert hunk
    let deleted = "";
    let inserted = "";

    while (i < diffs.length && diffs[i][0] !== DIFF_EQUAL) {
      if (diffs[i][0] === DIFF_DELETE) {
        deleted += diffs[i][1];
      } else if (diffs[i][0] === DIFF_INSERT) {
        inserted += diffs[i][1];
      }
      i++;
    }

    // Safety check: only accept if ALL changed chars are punctuation
    if (isPunctuationOnly(deleted) && isPunctuationOnly(inserted)) {
      // Build context snippet from the original text
      const ctxBefore = original.slice(Math.max(0, pos - 20), pos);
      const ctxAfter = original.slice(pos + deleted.length, pos + deleted.length + 20);
      const context = `${ctxBefore}[${deleted}\u2192${inserted}]${ctxAfter}`;

      corrections.push({
        position: paragraphStart + pos,
        original: deleted,
        replacement: inserted,
        context,
      });
    }
    // else: silently reject this hunk (LLM changed non-punctuation)

    pos += deleted.length;
  }

  return corrections;
}
