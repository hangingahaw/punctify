import type { Message } from "@lexstyle/llm-client";
import type { Paragraph } from "./types.js";

/**
 * Build the messages array for a single LLM call.
 *
 * System prompt contains the rules (sent once).
 * User prompt contains the paragraph texts with their IDs.
 */
export function buildMessages(
  paragraphs: readonly Paragraph[],
  rules?: string
): Message[] {
  const ruleBlock = rules
    ? `\n${rules}\n`
    : "";

  const system = `You are a punctuation expert. Your task is to correct punctuation errors in the paragraphs below.
${ruleBlock}
CONSTRAINTS — you MUST follow these exactly:
- ONLY change punctuation characters (commas, periods, semicolons, colons, quotes, apostrophes, dashes, parentheses, etc.)
- Do NOT change any words, spelling, capitalization, or spacing
- Do NOT add or remove words
- Do NOT rewrite sentences
- If a paragraph has no punctuation errors, return it unchanged

IMPORTANT: You must return exactly one entry for every id provided. Do not skip any.
Respond with ONLY a JSON array. No explanation, no markdown fences.
Format: [{"id":0,"text":"corrected paragraph"},{"id":1,"text":"corrected paragraph"}]`;

  const user = paragraphs
    .map((p) => `[${p.id}] ${p.text}`)
    .join("\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
