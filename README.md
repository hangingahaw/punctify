# punctify

[![npm](https://img.shields.io/npm/v/punctify)](https://www.npmjs.com/package/punctify)
[![license](https://img.shields.io/npm/l/punctify)](https://github.com/hangingahaw/punctify/blob/main/LICENSE)

Paragraph-level punctuation correction powered by LLMs.

Splits text into paragraphs, sends them to an LLM for correction, then diffs the result and accepts only punctuation-character changes. Word changes, capitalization changes, and spacing changes are rejected by the safety filter — the LLM can only fix punctuation.

## Install

```sh
npm install punctify
```

## Quick start

```ts
import { punctify } from 'punctify'

const result = await punctify(
  'The court considered standing ripeness and mootness.',
  { apiKey: process.env.OPENAI_API_KEY, provider: 'openai' }
)

result.text
// → 'The court considered standing, ripeness, and mootness.'

result.corrections
// → [{ position: 30, original: ' ', replacement: ', ', context: '...' }, ...]

result.unchanged
// → false
```

## Providers

Built-in support for any OpenAI-compatible API, plus a native Anthropic adapter.

| Provider | Default model | Notes |
|---|---|---|
| `openai` | `gpt-4o-mini` | |
| `anthropic` | `claude-haiku-4-5-20251001` | Native adapter (different API format) |
| `gemini` | `gemini-2.0-flash` | OpenAI-compatible endpoint |
| `groq` | `llama-3.3-70b-versatile` | |
| `together` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | |
| `mistral` | `mistral-small-latest` | |
| `xai` | `grok-3-mini-fast` | |
| `deepseek` | `deepseek-chat` | |
| `openrouter` | *(none — must specify `model`)* | |

### Custom LLM function

Bypass the built-in client entirely:

```ts
const result = await punctify(text, {
  llm: async (messages) => {
    const res = await myLlmCall(messages)
    return res.text
  },
})
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | API key for the LLM provider |
| `provider` | `Provider` | — | Provider name (maps to base URL + default model) |
| `model` | `string` | *(per provider)* | Model name. Required if no provider default. |
| `baseURL` | `string` | — | Custom endpoint URL. Overrides provider mapping. |
| `llm` | `(messages) => Promise<string>` | — | Custom LLM function. Overrides apiKey/provider/model. |
| `rules` | `string` | `""` | Custom rules prepended to the system prompt |
| `batchSize` | `number` | `10` | Maximum paragraphs per LLM call |

You must provide either `apiKey` (with `provider` or `model`) or `llm`.

## Result

```ts
interface PunctifyResult {
  text: string          // The corrected text
  corrections: Array<{  // Only punctuation that was changed
    position: number    // Index in original text
    original: string    // What was there
    replacement: string // What it became
    context: string     // Surrounding snippet for audit
  }>
  unchanged: boolean    // true if nothing was modified
}
```

**No paragraphs in text:** LLM is not called. Returns immediately with `unchanged: true`.

**All punctuation already correct:** LLM is called, but `corrections` is empty and `unchanged` is `true`.

## Custom rules

Works with [lexstyle](https://github.com/hangingahaw/lexstyle) for structured rule management:

```ts
import { rules, serialize } from 'lexstyle'
import { punctify } from 'punctify'

const result = await punctify(text, {
  apiKey: process.env.OPENAI_API_KEY,
  provider: 'openai',
  rules: serialize(rules, 'punctuation'),
})
```

## Design decisions

**Paragraph-level, not character-level.** Punctuation is dense — every sentence has multiple marks. A comma's correctness depends on clause structure (Oxford comma, which vs that, semicolons in complex lists). Sending full paragraphs gives the LLM the clause context it needs.

**Safety filter.** The LLM returns corrected paragraphs, but only punctuation-character changes are accepted. Character-level diffing (via diff-match-patch) rejects any hunk that touches letters, digits, or non-punctuation symbols. The allowlist is explicit: `.,:;?!'"()[]{}/-\` and their typographic variants.

**CRLF-aware.** Paragraph splitting normalizes `\r\n` to `\n` internally, with offset mapping that preserves correct positions in the original text.

**Batch validation.** Each batch response is validated against its expected IDs before merging.

**Robust response parsing.** Strict JSON first, bracket-extraction fallback for LLM preamble text.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build     # ESM + CJS + .d.ts
```

## License

Apache-2.0
