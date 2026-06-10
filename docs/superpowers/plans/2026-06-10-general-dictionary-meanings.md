# General Dictionary Meanings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add general dictionary meanings (POS + Chinese meaning + English keyword + example sentence) below the contextual meaning in the popup, sourced from a second concurrent DeepSeek call.

**Architecture:** Add `fetchGeneralMeanings()` to the DeepSeek utility, fire it concurrently with the existing contextual call in `useWordMeaning.lookup()`, extend the result state type, and render the new section in `WordPopup` with new CSS classes.

**Tech Stack:** React, TypeScript, DeepSeek Chat API, WXT Chrome Extension framework

---

### Task 1: Add `fetchGeneralMeanings` to `utils/deepseek.ts`

**Files:**
- Modify: `utils/deepseek.ts`

- [ ] **Step 1: Add `GeneralMeaning` type and `fetchGeneralMeanings` function**

Add after the `SYSTEM_PROMPT` constant (line 6) and after the `FetchDefinitionResult` function (before the closing of the file):

After `const SYSTEM_PROMPT = ...` (line 6), insert:

```typescript
const GENERAL_PROMPT =
  "你是一个词典助手。请针对单词输出其所有常见词性及对应释义，以JSON格式返回。\n" +
  "格式：{\"meanings\":[{\"pos\":\"n.\",\"meaning\":\"中文释义\",\"keyword\":\"english keyword\",\"example\":\"example sentence\"},...]}\n\n" +
  "要求：\n" +
  "1. 忽略没有实际用法的词性\n" +
  "2. 每个词性提供一个英文例句，需能体现该释义的用法\n" +
  "3. 仅输出JSON，不要任何额外解释";
```

Add after the `DefinitionError` interface (around line 17):

```typescript
export interface GeneralMeaning {
  pos: string;
  meaning: string;
  keyword: string;
  example: string;
}
```

Add after the `fetchDefinition` function (end of file):

```typescript
export async function fetchGeneralMeanings(
  word: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<GeneralMeaning[]> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: GENERAL_PROMPT },
          { role: "user", content: `查词: ${word}` },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return [];

    // DeepSeek may wrap JSON in markdown code fences — strip them
    let json = raw;
    if (json.startsWith("```")) {
      json = json.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
    }

    const parsed = JSON.parse(json);
    if (Array.isArray(parsed.meanings)) {
      return parsed.meanings as GeneralMeaning[];
    }
    return [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
pnpm build
```

Expected: Build succeeds (the function is exported but not yet imported anywhere — that's fine).

- [ ] **Step 3: Commit**

```bash
git add utils/deepseek.ts
git commit -m "feat: add fetchGeneralMeanings for dictionary-style word lookup"
```

---

### Task 2: Extend state and fire concurrent calls in `hooks/useWordMeaning.ts`

**Files:**
- Modify: `hooks/useWordMeaning.ts`

- [ ] **Step 1: Import the new function and type**

Change the import on line 5 from:

```typescript
import { fetchDefinition, FetchDefinitionResult } from "../utils/deepseek";
```

to:

```typescript
import { fetchDefinition, FetchDefinitionResult, fetchGeneralMeanings, GeneralMeaning } from "../utils/deepseek";
```

- [ ] **Step 2: Extend the `result` variant of `MeaningState`**

Change the `result` line (line 10) from:

```typescript
  | { status: "result"; word: string; meaning: string; sentence?: string | null }
```

to:

```typescript
  | { status: "result"; word: string; meaning: string; sentence?: string | null; generalMeanings?: GeneralMeaning[] }
```

- [ ] **Step 3: Fire both API calls concurrently in `lookup()`**

Inside `lookup()`, after line 30 (`abortRef.current = controller;`) and before the `const result: FetchDefinitionResult = await fetchDefinition(...)` line, replace the single `fetchDefinition` call. Change:

```typescript
    const result: FetchDefinitionResult = await fetchDefinition(word, apiKey, sentence ?? undefined);
```

to:

```typescript
    const [contextResult, generalMeanings] = await Promise.all([
      fetchDefinition(word, apiKey, sentence ?? undefined),
      fetchGeneralMeanings(word, apiKey, controller.signal).catch(() => [] as GeneralMeaning[]),
    ]);
```

- [ ] **Step 4: Update the result state setter**

Change the `if ("meaning" in result)` block (line 38-42). Replace `result` with `contextResult` throughout:

Change from:

```typescript
    if ("meaning" in result) {
      setState({ status: "result", word: result.word, meaning: result.meaning, sentence });
    } else {
      setState({ status: "error", word: result.word, error: result.error });
    }
```

to:

```typescript
    if ("meaning" in contextResult) {
      setState({
        status: "result",
        word: contextResult.word,
        meaning: contextResult.meaning,
        sentence,
        generalMeanings: generalMeanings.length > 0 ? generalMeanings : undefined,
      });
    } else {
      setState({ status: "error", word: contextResult.word, error: contextResult.error });
    }
```

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add hooks/useWordMeaning.ts
git commit -m "feat: fetch general dictionary meanings concurrently with contextual meaning"
```

---

### Task 3: Render general meanings section in `components/WordPopup.tsx`

**Files:**
- Modify: `components/WordPopup.tsx`

- [ ] **Step 1: Add the general meanings rendering block**

Inside the `state.status === "result"` branch, add the new section after `lingo-meaning` and before `lingo-sentence`. The fragment starting at line 33 becomes:

```tsx
      {state.status === "result" && (
        <>
          <div className="lingo-word">{state.word}</div>
          <div className="lingo-meaning">{state.meaning}</div>
          {state.generalMeanings && state.generalMeanings.length > 0 && (
            <div className="lingo-general-section">
              {state.generalMeanings.map((gm, i) => (
                <div key={i} className="lingo-general-item">
                  <div className="lingo-general-pos">
                    <span className="lingo-general-pos-label">{gm.pos}</span>
                    <span className="lingo-general-meaning">{gm.meaning}</span>
                    <span className="lingo-general-keyword">({gm.keyword})</span>
                  </div>
                  <div className="lingo-general-example">{gm.example}</div>
                </div>
              ))}
            </div>
          )}
          {state.sentence && (
            <div className="lingo-sentence">{state.sentence}</div>
          )}
        </>
      )}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/WordPopup.tsx
git commit -m "feat: render general dictionary meanings section in WordPopup"
```

---

### Task 4: Add styles in `styles/popup.css`

**Files:**
- Modify: `styles/popup.css`

- [ ] **Step 1: Add CSS for the general meanings section**

Append to the end of `styles/popup.css`:

```css
.lingo-general-section {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
}

.lingo-general-item {
  margin-bottom: 4px;
}

.lingo-general-item:last-child {
  margin-bottom: 0;
}

.lingo-general-pos {
  font-size: 12px;
  line-height: 1.4;
}

.lingo-general-pos-label {
  font-weight: 600;
  color: #64748b;
  margin-right: 4px;
}

.lingo-general-meaning {
  color: #475569;
}

.lingo-general-keyword {
  color: #94a3b8;
  font-size: 11px;
  margin-left: 3px;
}

.lingo-general-example {
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
  margin-left: 8px;
  line-height: 1.4;
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add styles/popup.css
git commit -m "feat: add styles for general dictionary meanings section"
```

---

### Task 5: Final verification

- [ ] **Step 1: Rebuild and confirm clean**

```bash
pnpm build
```

Expected: Build completes with no errors.

- [ ] **Step 2: Verify all changes are committed**

```bash
git log --oneline -5
```

Expected: See the 4 feature commits plus the spec commit.
