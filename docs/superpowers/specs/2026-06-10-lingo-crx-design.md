# Lingo CRX — Chrome Extension Design Spec

**Date**: 2026-06-10
**Status**: Draft

## Overview

A Chrome extension that allows users to click on any word in a webpage and see a brief Chinese definition in a floating popup below the clicked word. Definitions are fetched from the DeepSeek API.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Extension Framework | WXT |
| Language | TypeScript |
| UI | React |
| Package Manager | pnpm |
| Styling | Tailwind CSS (injected via Shadow DOM) |
| Storage | chrome.storage.sync |
| API Client | Native fetch (no SDK) |

## Project Structure

```
lingo-crx/
├── entrypoints/
│   ├── content.ts          # Content script — listen for clicks, inject popup
│   └── options/
│       ├── index.html      # Options page — user enters DeepSeek API Key
│       └── App.tsx         # Options page React component
├── components/
│   ├── WordPopup.tsx        # Floating popup component (rendered in Shadow DOM)
│   └── LoadingSpinner.tsx   # Loading state indicator
├── hooks/
│   ├── useWordMeaning.ts    # Fetch definition from DeepSeek API
│   └── useClickPosition.ts  # Calculate popup position from click coordinates
├── utils/
│   ├── storage.ts           # chrome.storage sync/local wrappers
│   └── deepseek.ts          # DeepSeek API client (fetch-based)
├── styles/
│   └── popup.css            # Popup styles (injected into Shadow DOM)
├── wxt.config.ts            # WXT configuration
└── package.json
```

### Entry Points

1. **`content.ts`** — Injected into every page. Listens for `click` events on text nodes.
2. **`options/index.html`** — Chrome extension options page where users configure their DeepSeek API key.
3. **`background.ts`** (optional) — Only if cross-tab state synchronization is needed.

## Architecture

### Activation

- **Always on**: Every click on a text word in any page triggers the popup. No toggle, no modifier key, no double-click.

### Data Flow

```
User clicks a word
    │
    ▼
content.ts
  1. Detect click on text element
  2. Extract the word under cursor (split by spaces/punctuation)
  3. Calculate popup position (below the word, 6px gap)
    │
    ▼
useWordMeaning hook
  1. Read API key from chrome.storage.sync
  2. POST https://api.deepseek.com/v1/chat/completions
  3. System prompt: brief Chinese definition only
  4. Return { word, meaning }
    │
    ▼
WordPopup component (inside Shadow DOM)
  Display: [word]: [Chinese definition]
  States: loading → result | error
```

### Popup Lifecycle

1. Word clicked → create Shadow DOM container → mount React Popup → call API
2. Show loading spinner → receive result → replace with definition
3. Click anywhere outside popup → unmount component, remove Shadow DOM
4. Only one popup exists at a time (new click dismisses the old one)

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No API Key configured | Popup shows "请先在设置页配置 API Key" with a link to options page |
| API call fails (network/rate limit) | Popup shows error message, auto-dismisses after 3 seconds |
| Click on non-text (image, input, whitespace) | No popup triggered |
| Word not extractable (edge cases) | No popup triggered — silent no-op |

## DeepSeek API Integration

**Endpoint**: `POST https://api.deepseek.com/v1/chat/completions`

```json
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "你是一个词典助手。只返回单词的简短中文释义，格式：'释义'，不要任何额外解释。"
    },
    {
      "role": "user",
      "content": "查词: {word}"
    }
  ],
  "max_tokens": 80,
  "temperature": 0.3
}
```

- `temperature: 0.3` — low temperature for consistent, reliable definitions
- `max_tokens: 80` — limits response length to brief definition
- No OpenAI SDK dependency — native `fetch` is sufficient (DeepSeek is OpenAI-compatible)

### API Key Management

- User pastes their own DeepSeek API key into the extension's options page
- Key is stored in `chrome.storage.sync` (persisted, synced across user's Chrome instances)
- Content script reads key from storage before each API call
- Options page provides a link/button to the DeepSeek platform for obtaining a key

## Popup UI

### States

**Loading**:
```
┌─────────────────────┐
│ ◉  serendipity      │  ← spinning indicator
│    查询中...          │
└─────────────────────┘
```

**Result**:
```
┌─────────────────────┐
│ serendipity          │
│ 意外发现美好事物的能力  │
└─────────────────────┘
```

**Error (no API key)**:
```
┌──────────────────────┐
│ 请先配置 API Key       │
│ 前往设置 →             │  ← clickable link to options
└──────────────────────┘
```

### Visual Spec

| Property | Value |
|----------|-------|
| Background | White (#FFFFFF) |
| Border radius | 8px |
| Box shadow | 0 2px 12px rgba(0,0,0,0.15) |
| Max width | 280px |
| Font size | 12px (definition), 13px bold (word) |
| Padding | 10px 14px |
| Positioning | Below clicked word, 6px gap |
| Overflow handling | Flip above if popup would overflow viewport bottom |
| Z-index | Highest (2147483647 — max safe z-index) |

### Style Isolation

- Popup rendered inside **Shadow DOM** to completely isolate styles from the host page
- Tailwind CSS styles are injected into the Shadow DOM root
- Host page CSS cannot affect the popup, and popup styles cannot leak to the page

## Non-Goals (YAGNI)

- No offline dictionary fallback
- No caching of word meanings
- No pronunciation/audio
- No word history / bookmarks
- No multiple language support (Chinese definition only)
- No right-click context menu integration
- No keyboard shortcut for lookup
- No site-specific blacklist/whitelist (always on, all pages)

## Open Questions

- None — all decisions confirmed during design review.
