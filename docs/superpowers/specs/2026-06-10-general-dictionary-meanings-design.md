# General Dictionary Meanings in Popup

Date: 2026-06-10

## Goal

Below the contextual meaning (`lingo-meaning`), show general dictionary entries for the word — each common part of speech with its Chinese meaning, English keyword, and an example sentence.

## Data Flow

1. User clicks word → `useWordMeaning.lookup()` fires
2. Two concurrent DeepSeek API calls:
   - **Call 1 (existing):** contextual Chinese meaning from sentence context
   - **Call 2 (new):** general dictionary meanings for the word
3. Both results merged into state; popup renders when both resolve

## Types

```typescript
interface GeneralMeaning {
  pos: string;      // "n.", "v.", "adj.", "adv."
  meaning: string;  // Chinese meaning
  keyword: string;  // English keyword(s)
  example: string;  // English example sentence
}
```

`MeaningState` result variant gains optional `generalMeanings`:

```typescript
| { status: "result"; word: string; meaning: string; sentence?: string | null; generalMeanings?: GeneralMeaning[] }
```

## API Prompt (Call 2)

```
你是一个词典助手。请针对单词输出其所有常见词性及对应释义，以JSON格式返回。
格式：{"meanings":[{"pos":"n.","meaning":"中文释义","keyword":"english keyword","example":"example sentence"},...]}

要求：
1. 忽略没有实际用法的词性
2. 每个词性提供一个英文例句，需能体现该释义的用法
3. 仅输出JSON，不要任何额外解释
```

## Display Layout

```
┌─────────────────────────────────┐
│ apple                           │  lingo-word
│ 苹果                             │  lingo-meaning (contextual)
│ "I ate an apple for lunch."     │  lingo-sentence (optional, context)
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  dashed separator
│ n. 苹果 (apple)                  │  lingo-general-item
│   I ate a juicy apple.          │  ↳ example (indented)
│ adj. 苹果的 (apple-like)         │  lingo-general-item
│   She made apple pie.           │  ↳ example
└─────────────────────────────────┘
```

## Files to Modify

| File | Change |
|------|--------|
| `utils/deepseek.ts` | Add `fetchGeneralMeanings()` function, return typed `GeneralMeaning[]` |
| `hooks/useWordMeaning.ts` | Fire both calls concurrently in `lookup()`, extend `MeaningState` |
| `components/WordPopup.tsx` | Render `lingo-general` section below `lingo-meaning` when data present |
| `styles/popup.css` | Add `.lingo-general-separator`, `.lingo-general-item`, `.lingo-general-pos`, `.lingo-general-example` |

## Error Handling

- **JSON parse failure:** catch, return `[]`, don't render the section
- **API failure (both calls):** same as today — show error state
- **API failure (general call only):** show contextual meaning, silently omit general section
- **Abort:** shared `AbortController`, both calls canceled together on new lookup or unmount
- **Empty general meanings:** don't render the section

## Loading Behavior

- Spinner shown until BOTH calls resolve (contextual meaning is primary content)
- The contextual call typically returns first; the general section pops in when its call completes
