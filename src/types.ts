import type { LlmOptions, Message } from "@lexstyle/llm-client";

// Re-export LLM types so consumers don't need a separate import
export type { Message, Provider } from "@lexstyle/llm-client";

/** Result of applying corrections to text */
export interface ApplyResult {
  text: string;
  appliedCorrections: PunctCorrection[];
}

/** A paragraph extracted from the input text */
export interface Paragraph {
  id: number;
  text: string;
  /** Start index in the original text */
  start: number;
  /** End index in the original text (exclusive) */
  end: number;
}

/** A single punctuation correction applied to the text */
export interface PunctCorrection {
  /** Absolute position in the original text */
  position: number;
  /** The original character(s) */
  original: string;
  /** The replacement character(s) */
  replacement: string;
  /** Surrounding context snippet */
  context: string;
}

/** Result returned by punctify */
export interface PunctifyResult {
  /** The corrected text */
  text: string;
  /** List of corrections that were applied */
  corrections: PunctCorrection[];
  /** True if no changes were needed */
  unchanged: boolean;
}

/** Options for punctify */
export interface PunctifyOptions extends LlmOptions {
  /** Custom rules to prepend to the system prompt */
  rules?: string;
  /** Maximum paragraphs per LLM call (default: 10). Must be >= 1. */
  batchSize?: number;
}

/** LLM response item for a single paragraph */
export interface ParagraphCorrection {
  id: number;
  /** The LLM's corrected paragraph text */
  text: string;
}
