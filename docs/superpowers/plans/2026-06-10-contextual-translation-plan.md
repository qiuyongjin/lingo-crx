# Contextual Word Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send surrounding sentence context alongside the clicked word to DeepSeek API, so translations account for context (e.g., "chair" in "chair the meeting" → "主持" not "椅子").

**Architecture:** Modify `extractWordFromPoint` to also extract the surrounding sentence from the DOM using a `TreeWalker` on the containing block element. Pipe `sentence` through `useWordMeaning.lookup()` → `fetchDefinition()` → updated System Prompt. Display sentence context in `WordPopup`.

**Tech Stack:** TypeScript, React, Chrome Extension (WXT), DeepSeek Chat API

---

### Task 1: Update WordInfo interface and extractWordFromPoint

**Files:**
- Modify: `utils/wordExtractor.ts` (entire file)

- [ ] **Step 1: Update `WordInfo` interface and add `extractSentence` helper**

Replace the entire file with:

```typescript
// utils/wordExtractor.ts

export interface WordInfo {
  word: string;
  rect: DOMRect;
  sentence: string | null;
}

const SENTENCE_TERMINATOR = /[.。!！?？]/;
const BLOCK_TAGS = new Set([
  "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6",
  "LI", "TD", "TH", "SECTION", "ARTICLE", "BLOCKQUOTE",
  "PRE", "BODY", "MAIN", "ASIDE", "NAV", "HEADER", "FOOTER",
]);

/**
 * Extract the word at the given viewport coordinates.
 * Also extracts the surrounding sentence for context-aware translation.
 * Returns null if no word is found at that position.
 */
export function extractWordFromPoint(x: number, y: number): WordInfo | null {
  const range = getCaretRangeFromPoint(x, y);
  if (!range) return null;

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent || "";
  const offset = range.startOffset;
  if (offset < 0 || offset > text.length) return null;

  // Find word boundaries (supports Latin and CJK characters)
  const wordRegex = /[\w一-鿿㐀-䶿]/u;
  let start = offset;
  let end = offset;

  // Expand left
  while (start > 0 && wordRegex.test(text[start - 1])) {
    start--;
  }

  // Expand right
  while (end < text.length && wordRegex.test(text[end])) {
    end++;
  }

  const word = text.slice(start, end).trim();
  if (!word || word.length === 0 || word.length > 50) return null;

  // Get bounding rect for the word
  const wordRange = document.createRange();
  wordRange.setStart(node, start);
  wordRange.setEnd(node, end);
  const rect = wordRange.getBoundingClientRect();

  // Extract surrounding sentence
  const sentence = extractSentence(node, start, end, word);

  return { word, rect, sentence };
}

/**
 * Find the nearest block-level ancestor of a node.
 */
function findBlockAncestor(node: Node): Element | null {
  let el: Node | null = node;
  while (el) {
    if (
      el.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((el as Element).tagName)
    ) {
      return el as Element;
    }
    el = el.parentNode;
  }
  return null;
}

/**
 * Calculate the character offset of a text node + offset within a block's full text.
 */
function textOffsetInBlock(
  block: Element,
  targetNode: Node,
  targetOffset: number
): number {
  let pos = 0;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node === targetNode) {
      return pos + targetOffset;
    }
    pos += (node.textContent || "").length;
  }
  return -1;
}

/**
 * Extract the sentence containing the word from the containing block element.
 * Returns null if no sentence terminators are found (e.g., button text, list items).
 */
function extractSentence(
  textNode: Node,
  wordStart: number,
  wordEnd: number,
  word: string
): string | null {
  const block = findBlockAncestor(textNode);
  if (!block) return null;

  const fullText = block.textContent || "";
  if (!fullText) return null;

  // Find the word's position in the block's full text
  const wordOffset = textOffsetInBlock(block, textNode, wordStart);
  if (wordOffset < 0 || wordOffset >= fullText.length) return null;

  // Search left for sentence terminator
  let sentStart = 0;
  for (let i = wordOffset - 1; i >= 0; i--) {
    if (SENTENCE_TERMINATOR.test(fullText[i])) {
      sentStart = i + 1;
      break;
    }
  }

  // Search right for sentence terminator
  let sentEnd = fullText.length;
  for (let i = wordOffset + word.length; i < fullText.length; i++) {
    if (SENTENCE_TERMINATOR.test(fullText[i])) {
      sentEnd = i + 1; // include the terminator
      break;
    }
  }

  // If no terminator on either side, no sentence structure — return null
  if (sentStart === 0 && sentEnd === fullText.length) return null;

  let sentence = fullText.substring(sentStart, sentEnd).trim();
  if (!sentence) return null;

  // Truncate if too long
  if (sentence.length > 500) {
    sentence = sentence.substring(0, 500);
  }

  // Replace the word at its exact position with {word} markup
  const wordPosInSentence = wordOffset - sentStart;
  if (
    wordPosInSentence >= 0 &&
    wordPosInSentence + word.length <= sentence.length
  ) {
    sentence =
      sentence.substring(0, wordPosInSentence) +
      "{" +
      word +
      "}" +
      sentence.substring(wordPosInSentence + word.length);
  }

  return sentence;
}

function getCaretRangeFromPoint(x: number, y: number): Range | null {
  try {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(x, y);
    }
    // Fallback for older browsers
    const caretPos = (document as any).caretPositionFromPoint?.(x, y);
    if (caretPos) {
      const range = document.createRange();
      range.setStart(caretPos.offsetNode, caretPos.offset);
      range.setEnd(caretPos.offsetNode, caretPos.offset);
      return range;
    }
  } catch {
    // caretRangeFromPoint can throw on some shadow DOM boundaries
  }
  return null;
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
pnpm build
```
Expected: Build succeeds with no errors in wordExtractor.ts.

---

### Task 2: Update DeepSeek API layer

**Files:**
- Modify: `utils/deepseek.ts:5-7` (SYSTEM_PROMPT)
- Modify: `utils/deepseek.ts:21-23` (function signature)
- Modify: `utils/deepseek.ts:35-36` (user message)

- [ ] **Step 1: Update SYSTEM_PROMPT**

Replace line 5-6:
```typescript
const SYSTEM_PROMPT =
  "你是一个词典助手。只返回单词的简短中文释义，格式：'释义'，不要任何额外解释。";
```
With:
```typescript
const SYSTEM_PROMPT =
  "你是一个词典助手。用户提供句子和{}标记的单词时，根据语境翻译该单词的准确中文释义。用户仅提供单词时，翻译该单词的常见中文释义。格式：'释义'，不要任何额外解释。";
```

- [ ] **Step 2: Add `sentence` parameter to `fetchDefinition`**

Replace the function signature (line 21-24):
```typescript
export async function fetchDefinition(
  word: string,
  apiKey: string
): Promise<FetchDefinitionResult> {
```
With:
```typescript
export async function fetchDefinition(
  word: string,
  apiKey: string,
  sentence?: string | null
): Promise<FetchDefinitionResult> {
```

- [ ] **Step 3: Update user message construction**

Replace the user message line (line 36):
```typescript
{ role: "user", content: `查词: ${word}` },
```
With:
```typescript
{ role: "user", content: sentence ? `句子: ${sentence}` : `查词: ${word}` },
```

- [ ] **Step 4: Build to verify**

```bash
pnpm build
```
Expected: Build succeeds.

---

### Task 3: Update useWordMeaning hook

**Files:**
- Modify: `hooks/useWordMeaning.ts:18` (lookup signature)
- Modify: `hooks/useWordMeaning.ts:33` (fetchDefinition call)
- Modify: `hooks/useWordMeaning.ts:39` (result state)

- [ ] **Step 1: Add `sentence` parameter to `lookup`**

Replace `async function lookup(word: string)` (line 18) with:
```typescript
async function lookup(word: string, sentence?: string | null) {
```

- [ ] **Step 2: Pass `sentence` to `fetchDefinition`**

Replace `const result: FetchDefinitionResult = await fetchDefinition(word, apiKey);` (line 33) with:
```typescript
const result: FetchDefinitionResult = await fetchDefinition(word, apiKey, sentence ?? undefined);
```

- [ ] **Step 3: Include `sentence` in result state**

Replace `setState({ status: "result", word: result.word, meaning: result.meaning });` (line 39) with:
```typescript
setState({ status: "result", word: result.word, meaning: result.meaning, sentence });
```

- [ ] **Step 4: Update `MeaningState` type**

Replace the `"result"` union member (line 10):
```typescript
| { status: "result"; word: string; meaning: string }
```
With:
```typescript
| { status: "result"; word: string; meaning: string; sentence?: string | null }
```

- [ ] **Step 5: Build to verify**

```bash
pnpm build
```
Expected: Build succeeds.

---

### Task 4: Wire sentence into content script

**Files:**
- Modify: `entrypoints/content.tsx:24-27` (destructure sentence from wordInfo)
- Modify: `entrypoints/content.tsx:77` (pass sentence to lookup)

- [ ] **Step 1: Destructure `sentence` from wordInfo**

Replace lines 24-27:
```typescript
const wordInfo = extractWordFromPoint(x, y);
if (!wordInfo) return;

const word = wordInfo.word;
```
With:
```typescript
const wordInfo = extractWordFromPoint(x, y);
if (!wordInfo) return;

const { word, sentence } = wordInfo;
```

- [ ] **Step 2: Pass `sentence` to `lookup`**

Replace `lookup(word);` (line 77, inside `PopupApp`) with:
```typescript
lookup(word, sentence);
```

- [ ] **Step 3: Build to verify**

```bash
pnpm build
```
Expected: Build succeeds.

---

### Task 5: Display sentence context in WordPopup

**Files:**
- Modify: `components/WordPopup.tsx:34-36` (result section)

- [ ] **Step 1: Add sentence display in result state**

Replace lines 34-36:
```tsx
{state.status === "result" && (
  <>
    <div className="lingo-word">{state.word}</div>
    <div className="lingo-meaning">{state.meaning}</div>
  </>
)}
```
With:
```tsx
{state.status === "result" && (
  <>
    <div className="lingo-word">{state.word}</div>
    <div className="lingo-meaning">{state.meaning}</div>
    {state.sentence && (
      <div className="lingo-sentence">{state.sentence}</div>
    )}
  </>
)}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm build
```
Expected: Build succeeds.

---

### Task 6: Add CSS styles for sentence display

**Files:**
- Modify: `styles/popup.css` (append after `.lingo-meaning` block)

- [ ] **Step 1: Add `.lingo-sentence` style**

Insert after the `.lingo-meaning` block (after line 44):
```css
.lingo-sentence {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
  word-break: break-word;
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm build
```
Expected: Build succeeds.

---

### Task 7: End-to-end verification

- [ ] **Step 1: Build the extension**

```bash
pnpm build
```
Expected: Clean build in `dist/chrome-mv3/`.

- [ ] **Step 2: Verify content script output**

```bash
grep -c "sentence" dist/chrome-mv3/content-scripts/content.js
```
Expected: Non-zero count — sentence logic is present in the built output.

- [ ] **Step 3: Commit all changes**

```bash
git add utils/wordExtractor.ts utils/deepseek.ts hooks/useWordMeaning.ts entrypoints/content.tsx components/WordPopup.tsx styles/popup.css
git commit -m "feat: add contextual sentence-based word translation"
```
