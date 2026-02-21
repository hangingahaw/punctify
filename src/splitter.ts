import type { Paragraph } from "./types.js";

/** Find all positions in the original text where \r\n occurs. */
function findCrPositions(text: string): number[] {
  const positions: number[] = [];
  let idx = 0;
  while ((idx = text.indexOf("\r\n", idx)) !== -1) {
    positions.push(idx);
    idx += 2;
  }
  return positions;
}

/**
 * Convert an offset in the normalized string to one in the original.
 *
 * Binary search for how many CRs were removed before normIdx;
 * each removed CR shifts subsequent original positions by +1.
 */
function toOriginal(normIdx: number, crPositions: readonly number[]): number {
  let lo = 0;
  let hi = crPositions.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    // Normalized position of this CR = crPositions[mid] - mid
    if (crPositions[mid] - mid < normIdx) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return normIdx + lo;
}

/**
 * Split text into paragraphs on double-newline boundaries (\n\n+).
 *
 * Handles both LF (\n) and CRLF (\r\n) line endings. CRLF sequences are
 * normalized to LF internally, but the returned start/end positions still
 * map correctly to the *original* text so callers can slice the original.
 *
 * Returns an array of Paragraph objects with positional metadata.
 * Separators (the \n\n+ sequences between paragraphs) are NOT included
 * in any paragraph's text, but the start/end positions allow lossless
 * reassembly by slicing the separators from the original text.
 */
export function splitParagraphs(text: string): Paragraph[] {
  if (text.length === 0) return [];

  // Normalize \r\n → \n for splitting, but keep a mapping back to the
  // original offsets so positions remain correct.
  const normalized = text.replace(/\r\n/g, "\n");

  // Build a mapping: normalizedOffset → originalOffset.
  // We only need to track the cumulative extra \r characters removed.
  const crPositions = findCrPositions(text);

  const paragraphs: Paragraph[] = [];
  // Match sequences of 2+ newlines in the normalized text
  const separatorRe = /\n{2,}/g;

  let lastEnd = 0; // tracks position in *normalized* text
  let id = 0;
  let match: RegExpExecArray | null;

  while ((match = separatorRe.exec(normalized)) !== null) {
    const paraText = normalized.slice(lastEnd, match.index);
    // Only add non-empty paragraphs
    if (paraText.length > 0) {
      paragraphs.push({
        id,
        text: paraText,
        start: toOriginal(lastEnd, crPositions),
        end: toOriginal(match.index, crPositions),
      });
      id++;
    }
    lastEnd = match.index + match[0].length;
  }

  // Add the final paragraph after the last separator (or the entire text if no separators)
  if (lastEnd < normalized.length) {
    const paraText = normalized.slice(lastEnd);
    paragraphs.push({
      id,
      text: paraText,
      start: toOriginal(lastEnd, crPositions),
      end: text.length,
    });
  }

  return paragraphs;
}
