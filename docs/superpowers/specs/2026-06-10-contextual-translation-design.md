# Contextual Word Translation Design

**Date:** 2026-06-10
**Status:** approved

## Problem

Currently, clicking a word sends only the word itself to DeepSeek for translation. This fails for words whose meaning depends on context.

**Example:** "chair the meeting" → clicks "chair" → returns "椅子" (noun), but the correct translation is "主持" (verb).

## Solution

Extract the word's surrounding sentence, mark the target word with `{}`, and send both to the AI for context-aware translation.

## Architecture

Three layers, each with a specific change:

```
extractWordFromPoint (existing)
        +
extractSentence (NEW)     →    fetchDefinition(word, sentence?) → WordPopup (sentence added)
  wordExtractor.ts              deepseek.ts                        WordPopup.tsx
```

### Layer 1: Sentence Extraction (`utils/wordExtractor.ts`)

Modified `extractWordFromPoint` to also extract the surrounding sentence. Since the function already creates a `Range` for the word, sentence extraction happens inline using that same Range — no separate public function needed.

**Algorithm:**
1. After locating the word, use the existing word Range to walk left/right through text nodes
2. Stop at sentence terminators (`.` `。` `！` `!` `？` `?`) or block-level element boundaries
3. Extract the text between boundaries
4. Replace the specific occurrence of `word` at the click position with `{word}` (using character offset, not string replace, to avoid ambiguity when word appears multiple times)
5. Return `null` if no sentence boundaries found

**Boundary rules:**
- Sentence terminators: `.  。  !  ！  ?  ？`
- Walk stops at block-level elements (DIV, P, H1-H6, LI, etc.)
- Maximum sentence length: 500 characters (safety limit)

**Updated `WordInfo` interface:**
- Now returns `sentence: string | null` alongside `word` and `rect`

### Layer 2: API Layer (`utils/deepseek.ts`)

**Updated System Prompt:**
```
你是一个词典助手。用户提供句子和{}标记的单词时，根据语境翻译该单词的准确中文释义。用户仅提供单词时，翻译该单词的常见中文释义。格式：'释义'，不要任何额外解释。
```

**Updated `fetchDefinition`:**
- Signature: `fetchDefinition(word: string, apiKey: string, sentence?: string)`
- When `sentence` is provided: user message = `"句子: {sentence}"`
- When no sentence: user message = `"查词: {word}"` (existing behavior)

### Layer 3: Display (`components/WordPopup.tsx`)

- Show the sentence context below the meaning, in a smaller, muted style
- Example display:
  ```
  chair
  主持 (v.)
  She will {chair} the meeting.
  ```
- Sentence line only shown when sentence context was used

## Data Flow (Updated)

1. Alt+Click → `mountPopup(x, y)`
2. `extractWordFromPoint(x, y)` → `{ word, rect, sentence }`
3. `useWordMeaning.lookup(word, sentence)` — hook accepts optional sentence
4. `fetchDefinition(word, apiKey, sentence)` → POST to DeepSeek with sentence
5. `WordPopup` renders: word, meaning, optional sentence context

## Error Handling / Edge Cases

| Case | Behavior |
|---|---|
| No sentence found (e.g., button text) | `sentence = null`, falls back to word-only lookup |
| Multiple occurrences of word in sentence | First occurrence replaced with `{}`, which is the one at click position |
| Sentence > 500 chars | Truncated at 500 chars |
| CJK text (no spaces/terminators) | Falls back to word-only (no sentence detected) |
| Abort/network errors | Same existing error handling, unaffected |

## Files Changed

| File | Change |
|---|---|
| `utils/wordExtractor.ts` | Add `extractSentence()`, update `WordInfo` interface to include `sentence` |
| `utils/deepseek.ts` | Update `SYSTEM_PROMPT`, add `sentence` param to `fetchDefinition` |
| `hooks/useWordMeaning.ts` | Pass `sentence` param through `lookup()` |
| `entrypoints/content.tsx` | Wire `wordInfo.sentence` into the lookup call |
| `components/WordPopup.tsx` | Display sentence context when available |
| `styles/popup.css` | Add styles for sentence context display |
