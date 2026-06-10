# Lingo CRX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that shows a brief Chinese definition in a floating popup when the user clicks any word on a webpage, using the DeepSeek API.

**Architecture:** WXT framework with React + TypeScript. Content script listens for clicks, extracts the word, calls DeepSeek API via native fetch, and renders a Shadow DOM-isolated popup below the clicked word. Options page for API key configuration stored in chrome.storage.sync.

**Tech Stack:** WXT, React 19, TypeScript, Tailwind CSS v4, pnpm

---

## File Structure

```
lingo-crx/
├── entrypoints/
│   ├── content.ts              # Content script — click listener + popup orchestration
│   └── options/
│       ├── index.html          # Options page HTML shell
│       ├── main.tsx            # Options page React entry
│       └── App.tsx             # Options page React component
├── components/
│   ├── WordPopup.tsx           # Floating popup (loading/result/error states)
│   └── LoadingSpinner.tsx      # Animated spinner component
├── hooks/
│   └── useWordMeaning.ts       # Fetch definition from DeepSeek API
├── utils/
│   ├── storage.ts              # chrome.storage.sync typed wrappers
│   ├── deepseek.ts             # DeepSeek API fetch client
│   └── wordExtractor.ts        # Extract word from click position
├── styles/
│   └── popup.css               # Tailwind CSS source for popup styles
├── wxt.config.ts               # WXT configuration
├── tsconfig.json
└── package.json
```

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `content.ts` | Click listener, word extraction, Shadow DOM container management, popup mount/unmount orchestration |
| `options/App.tsx` | API key input form with save feedback |
| `options/main.tsx` | ReactDOM entry for options page |
| `options/index.html` | HTML shell, imports main.tsx |
| `WordPopup.tsx` | Renders popup UI: loading spinner, definition text, error messages, dismiss link |
| `LoadingSpinner.tsx` | Pure presentational spinner |
| `useWordMeaning.ts` | React hook: reads API key from storage, calls deepseek.ts, returns { word, meaning, error, loading } |
| `storage.ts` | getApiKey() / setApiKey() — typed wrappers around chrome.storage.sync |
| `deepseek.ts` | fetchDefinition(word, apiKey) — POST to DeepSeek, parse response, return definition string |
| `wordExtractor.ts` | extractWordFromPoint(x, y) — uses caretRangeFromPoint to get the exact word under cursor |
| `popup.css` | Tailwind-generated styles to be injected into Shadow DOM |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `wxt.config.ts`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/jake/project/extension/lingo-crx
pnpm init
```

Expected: `package.json` created with default values.

- [ ] **Step 2: Install WXT and React dependencies**

```bash
pnpm add -D wxt @wxt-dev/module-react typescript @types/react @types/react-dom
pnpm add react react-dom
```

Expected: All packages installed, `node_modules/` and `pnpm-lock.yaml` created.

- [ ] **Step 3: Write package.json with correct scripts**

Edit `package.json` to contain:

```json
{
  "name": "lingo-crx",
  "version": "1.0.0",
  "description": "Click any word to see its Chinese definition",
  "private": true,
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip -b firefox",
    "postinstall": "wxt prepare"
  }
}
```

- [ ] **Step 4: Write wxt.config.ts**

```typescript
// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Lingo",
    description: "Click any word to see its Chinese definition",
    permissions: ["storage"],
    host_permissions: ["<all_urls>"],
  },
});
```

- [ ] **Step 5: Write tsconfig.json**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "skipLibCheck": true
  }
}
```

- [ ] **Step 6: Verify scaffolding**

```bash
pnpm build
```

Expected: Build succeeds with no entrypoints yet (WXT builds empty extension).

---

### Task 2: Storage Utility

**Files:**
- Create: `utils/storage.ts`

- [ ] **Step 1: Write the storage utility**

```typescript
// utils/storage.ts

const API_KEY_STORAGE_KEY = "deepseek-api-key";

export async function getApiKey(): Promise<string | undefined> {
  const result = await chrome.storage.sync.get(API_KEY_STORAGE_KEY);
  return result[API_KEY_STORAGE_KEY] as string | undefined;
}

export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.sync.set({ [API_KEY_STORAGE_KEY]: apiKey });
}

export async function onApiKeyChange(
  callback: (newKey: string | undefined) => void
): Promise<() => void> {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName === "sync" && API_KEY_STORAGE_KEY in changes) {
      callback(changes[API_KEY_STORAGE_KEY].newValue);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la utils/storage.ts
```

Expected: File exists.

---

### Task 3: DeepSeek API Client

**Files:**
- Create: `utils/deepseek.ts`

- [ ] **Step 1: Write the DeepSeek API client**

```typescript
// utils/deepseek.ts

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT =
  "你是一个词典助手。只返回单词的简短中文释义，格式：'释义'，不要任何额外解释。";

export interface DefinitionResult {
  word: string;
  meaning: string;
}

export interface DefinitionError {
  word: string;
  error: string;
  code: "NO_API_KEY" | "API_ERROR" | "NETWORK_ERROR";
}

export type FetchDefinitionResult = DefinitionResult | DefinitionError;

export async function fetchDefinition(
  word: string,
  apiKey: string
): Promise<FetchDefinitionResult> {
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `查词: ${word}` },
        ],
        max_tokens: 80,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        word,
        error: `API 请求失败 (${response.status}): ${errorText}`,
        code: "API_ERROR",
      };
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const meaning =
      data.choices?.[0]?.message?.content?.trim() || "未找到释义";

    return { word, meaning };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message === "Failed to fetch"
        ? "网络连接失败，请检查网络"
        : `请求出错: ${err instanceof Error ? err.message : String(err)}`;
    return { word, error: message, code: "NETWORK_ERROR" };
  }
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la utils/deepseek.ts
```

Expected: File exists.

---

### Task 4: Word Extractor Utility

**Files:**
- Create: `utils/wordExtractor.ts`

- [ ] **Step 1: Write the word extractor utility**

```typescript
// utils/wordExtractor.ts

export interface WordInfo {
  word: string;
  rect: DOMRect;
}

/**
 * Extract the word at the given viewport coordinates.
 * Returns null if no word is found at that position.
 */
export function extractWordFromPoint(x: number, y: number): WordInfo | null {
  // Try modern API first
  const range = getCaretRangeFromPoint(x, y);
  if (!range) return null;

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent || "";
  const offset = range.startOffset;
  if (offset < 0 || offset > text.length) return null;

  // Find word boundaries
  const wordRegex = /\w+/u;
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

  return { word, rect };
}

function getCaretRangeFromPoint(
  x: number,
  y: number
): Range | null {
  try {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(x, y);
    }
    // Fallback for older browsers
    if ((document as any).caretPositionFromPoint) {
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (pos) {
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
        return range;
      }
    }
  } catch {
    // caretRangeFromPoint can throw on some shadow DOM boundaries
  }
  return null;
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la utils/wordExtractor.ts
```

Expected: File exists.

---

### Task 5: LoadingSpinner Component

**Files:**
- Create: `components/LoadingSpinner.tsx`

- [ ] **Step 1: Write the LoadingSpinner component**

```typescript
// components/LoadingSpinner.tsx

export function LoadingSpinner() {
  return (
    <div className="lingo-spinner">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="lingo-spinner-svg"
      >
        <circle
          cx="7"
          cy="7"
          r="5"
          stroke="#cbd5e1"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M12 7a5 5 0 0 0-5-5"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la components/LoadingSpinner.tsx
```

Expected: File exists.

---

### Task 6: Popup Styles (CSS)

**Files:**
- Create: `styles/popup.css`

- [ ] **Step 1: Write the popup CSS**

```css
/* styles/popup.css */

/* CSS Reset for Shadow DOM isolation */
:host {
  all: initial;
}

.lingo-popup {
  position: fixed;
  z-index: 2147483647;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  max-width: 280px;
  padding: 10px 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  line-height: 1.5;
  pointer-events: auto;
  animation: lingo-fade-in 0.15s ease-out;
}

@keyframes lingo-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lingo-word {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 2px;
}

.lingo-meaning {
  font-size: 13px;
  color: #475569;
}

.lingo-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.lingo-spinner-svg {
  animation: lingo-spin 0.8s linear infinite;
}

@keyframes lingo-spin {
  to {
    transform: rotate(360deg);
  }
}

.lingo-error {
  font-size: 12px;
  color: #ef4444;
}

.lingo-no-key {
  font-size: 12px;
  color: #f59e0b;
}

.lingo-settings-link {
  color: #3b82f6;
  text-decoration: none;
  cursor: pointer;
  font-size: 12px;
  margin-top: 4px;
  display: inline-block;
}

.lingo-settings-link:hover {
  text-decoration: underline;
}

/* Arrow pointer below the popup */
.lingo-popup::after {
  content: "";
  position: absolute;
  top: -6px;
  left: 16px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid #ffffff;
}
```

- [ ] **Step 2: Add CSS type declaration**

Create `styles/popup.css.d.ts`:

```typescript
// styles/popup.css.d.ts
declare const css: string;
export default css;
```

- [ ] **Step 3: Verify files exist**

```bash
ls -la styles/popup.css styles/popup.css.d.ts
```

Expected: Both files exist.

---

### Task 7: useWordMeaning Hook

**Files:**
- Create: `hooks/useWordMeaning.ts`

- [ ] **Step 1: Write the useWordMeaning hook**

```typescript
// hooks/useWordMeaning.ts

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "../utils/storage";
import { fetchDefinition, FetchDefinitionResult } from "../utils/deepseek";

export type MeaningState =
  | { status: "idle" }
  | { status: "loading"; word: string }
  | { status: "result"; word: string; meaning: string }
  | { status: "no-api-key" }
  | { status: "error"; word: string; error: string };

export function useWordMeaning() {
  const [state, setState] = useState<MeaningState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function lookup(word: string) {
    // Abort any in-flight request
    abortRef.current?.abort();

    const apiKey = await getApiKey();
    if (!apiKey) {
      setState({ status: "no-api-key" });
      return;
    }

    setState({ status: "loading", word });

    const controller = new AbortController();
    abortRef.current = controller;

    const result: FetchDefinitionResult = await fetchDefinition(word, apiKey);

    // Don't update state if this request was aborted
    if (controller.signal.aborted) return;

    if ("meaning" in result) {
      setState({ status: "result", word: result.word, meaning: result.meaning });
    } else {
      setState({ status: "error", word: result.word, error: result.error });
    }
  }

  function reset() {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { state, lookup, reset } as const;
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la hooks/useWordMeaning.ts
```

Expected: File exists.

---

### Task 8: WordPopup Component

**Files:**
- Create: `components/WordPopup.tsx`

- [ ] **Step 1: Write the WordPopup component**

```typescript
// components/WordPopup.tsx

import { MeaningState } from "../hooks/useWordMeaning";
import { LoadingSpinner } from "./LoadingSpinner";

interface WordPopupProps {
  state: MeaningState;
  top: number;
  left: number;
  onOpenSettings: () => void;
}

export function WordPopup({
  state,
  top,
  left,
  onOpenSettings,
}: WordPopupProps) {
  return (
    <div
      className="lingo-popup"
      style={{ top: `${top}px`, left: `${left}px` }}
      data-testid="lingo-popup"
    >
      {state.status === "loading" && (
        <div className="lingo-loading">
          <LoadingSpinner />
          <span>{state.word}</span>
          <span>查询中...</span>
        </div>
      )}

      {state.status === "result" && (
        <>
          <div className="lingo-word">{state.word}</div>
          <div className="lingo-meaning">{state.meaning}</div>
        </>
      )}

      {state.status === "error" && (
        <div className="lingo-error">{state.error}</div>
      )}

      {state.status === "no-api-key" && (
        <div>
          <div className="lingo-no-key">
            请先配置 DeepSeek API Key
          </div>
          <a
            className="lingo-settings-link"
            onClick={(e) => {
              e.preventDefault();
              onOpenSettings();
            }}
          >
            前往设置 →
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la components/WordPopup.tsx
```

Expected: File exists.

---

### Task 9: Content Script Entrypoint

**Files:**
- Create: `entrypoints/content.ts`

- [ ] **Step 1: Write the content script**

```typescript
// entrypoints/content.ts

import { createRoot } from "react-dom/client";
import { useRef, useEffect } from "react";
import { WordPopup } from "../components/WordPopup";
import { useWordMeaning } from "../hooks/useWordMeaning";
import { extractWordFromPoint } from "../utils/wordExtractor";
import popupCss from "../styles/popup.css?inline";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  main() {
    let shadowContainer: HTMLDivElement | null = null;
    let reactRoot: ReturnType<typeof createRoot> | null = null;
    let outsideClickListener: ((e: MouseEvent) => void) | null = null;

    function mountPopup(x: number, y: number) {
      // Remove existing popup first
      unmountPopup();

      // Extract the word at the click position
      const wordInfo = extractWordFromPoint(x, y);
      if (!wordInfo) return; // No word found at this position — silent no-op

      const word = wordInfo.word;

      // Calculate position: below the word, 6px gap
      // Use the bounding rect of the word range for pixel-accurate positioning
      let top = wordInfo.rect.bottom + 6 + window.scrollY;
      let left = wordInfo.rect.left + window.scrollX;

      // If popup would overflow viewport bottom, flip it above the word
      const estimatedHeight = 60;
      if (top + estimatedHeight > window.scrollY + window.innerHeight) {
        top = wordInfo.rect.top - 6 - estimatedHeight;
        if (top < window.scrollY) {
          top = wordInfo.rect.bottom + 6 + window.scrollY; // fallback
        }
      }

      // Clamp left to prevent overflow off the right side of the viewport
      const maxLeft = window.scrollX + window.innerWidth - 280; // max-width
      left = Math.min(left, Math.max(maxLeft, window.scrollX + 8));

      // Create a zero-size anchor div that hosts the Shadow DOM.
      // Positioned absolutely so it doesn't affect page layout.
      shadowContainer = document.createElement("div");
      shadowContainer.style.position = "absolute";
      shadowContainer.style.top = "0";
      shadowContainer.style.left = "0";
      shadowContainer.style.width = "0";
      shadowContainer.style.height = "0";
      shadowContainer.style.zIndex = "2147483647";

      const shadowRoot = shadowContainer.attachShadow({ mode: "closed" });

      // Inject isolated styles into the Shadow DOM
      const styleEl = document.createElement("style");
      styleEl.textContent = popupCss;
      shadowRoot.appendChild(styleEl);

      // Create the React mount point inside the Shadow DOM
      const mountPoint = document.createElement("div");
      shadowRoot.appendChild(mountPoint);

      document.body.appendChild(shadowContainer);

      // PopupApp: a small inline component that bridges the useWordMeaning hook
      // to the WordPopup presentational component. Defined inline so it closes
      // over `word`, `top`, and `left` from mountPopup's scope.
      function PopupApp() {
        const { state, lookup, reset } = useWordMeaning();

        // Fire the API lookup once on mount, keyed on the word
        const startedRef = useRef(false);
        useEffect(() => {
          if (!startedRef.current) {
            startedRef.current = true;
            lookup(word);
          }
          // Only run on mount / word change
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [word]);

        return (
          <WordPopup
            state={state}
            top={top}
            left={left}
            onOpenSettings={() => {
              // Content scripts cannot call chrome.runtime.openOptionsPage() directly.
              // Use getURL to construct the options page URL and open in a new tab.
              window.open(chrome.runtime.getURL("options.html"), "_blank");
            }}
          />
        );
      }

      reactRoot = createRoot(mountPoint);
      reactRoot.render(<PopupApp />);

      // Dismiss the popup when the user clicks anywhere outside the Shadow DOM.
      // Use a setTimeout so the current click doesn't immediately dismiss it.
      outsideClickListener = (e: MouseEvent) => {
        if (shadowContainer && !shadowContainer.contains(e.target as Node)) {
          unmountPopup();
        }
      };
      setTimeout(() => {
        document.addEventListener("click", outsideClickListener!, true);
      }, 0);
    }

    function unmountPopup() {
      if (outsideClickListener) {
        document.removeEventListener("click", outsideClickListener, true);
        outsideClickListener = null;
      }
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
      if (shadowContainer) {
        shadowContainer.remove();
        shadowContainer = null;
      }
    }

    // Global click listener — captures every click on the page
    document.addEventListener(
      "click",
      (e: MouseEvent) => {
        // Don't intercept clicks on the popup itself (they bubble through Shadow DOM)
        if (shadowContainer?.contains(e.target as Node)) return;

        unmountPopup();
        mountPopup(e.clientX, e.clientY);
      },
      true // useCapture to get the event before the page's handlers
    );
  },
});
```

- [ ] **Step 2: Verify the content script compiles**

```bash
pnpm build
```

Expected: Build succeeds with content script and options page artifacts in `.output/`.

---

### Task 10: Options Page

**Files:**
- Create: `entrypoints/options/index.html`
- Create: `entrypoints/options/main.tsx`
- Create: `entrypoints/options/App.tsx`

- [ ] **Step 1: Write the options HTML shell**

```html
<!-- entrypoints/options/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lingo 设置</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        background: #f8fafc;
        color: #1e293b;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="./main.tsx" type="module"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the options main entry**

```typescript
// entrypoints/options/main.tsx

import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

- [ ] **Step 3: Write the options App component**

```typescript
// entrypoints/options/App.tsx

import { useState, useEffect } from "react";
import { getApiKey, setApiKey } from "../../utils/storage";

export function App() {
  const [apiKey, setApiKeyState] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApiKey().then((key) => {
      if (key) setApiKeyState(key);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    const trimmed = apiKey.trim();
    await setApiKey(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: "480px",
    margin: "40px auto",
    padding: "24px",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "8px",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "14px",
    color: "#64748b",
    marginBottom: "24px",
    lineHeight: 1.6,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "6px",
    color: "#475569",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
    fontFamily: "monospace",
    transition: "border-color 0.15s",
  };

  const buttonStyle: React.CSSProperties = {
    marginTop: "12px",
    padding: "8px 20px",
    background: saved ? "#22c55e" : "#3b82f6",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "16px",
    lineHeight: 1.6,
  };

  const linkStyle: React.CSSProperties = {
    color: "#3b82f6",
    textDecoration: "none",
  };

  if (loading) {
    return <div style={containerStyle}>加载中...</div>;
  }

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>Lingo 设置</h1>
      <p style={subtitleStyle}>
        配置 DeepSeek API Key 以启用单词释义功能。Key 将安全存储在你的浏览器中。
      </p>

      <label style={labelStyle} htmlFor="apikey">
        DeepSeek API Key
      </label>
      <input
        id="apikey"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKeyState(e.target.value)}
        placeholder="sk-..."
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#cbd5e1";
        }}
      />

      <button onClick={handleSave} style={buttonStyle}>
        {saved ? "✓ 已保存" : "保存"}
      </button>

      <p style={hintStyle}>
        还没有 API Key？前往{" "}
        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          DeepSeek 开放平台
        </a>{" "}
        创建。
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify build includes options page**

```bash
pnpm build
ls .output/chrome-mv3/options.html
```

Expected: `options.html` exists in the output directory.

---

### Task 11: Final Build Verification

- [ ] **Step 1: Clean build**

```bash
pnpm build
```

Expected: Build completes with no errors. Output in `.output/chrome-mv3/`.

- [ ] **Step 2: Verify all output artifacts**

```bash
ls -la .output/chrome-mv3/
```

Expected output files present:
- `manifest.json`
- `content-scripts/content.js` (or similar)
- `options.html`

- [ ] **Step 3: Check manifest.json for required permissions**

```bash
cat .output/chrome-mv3/manifest.json | python3 -m json.tool
```

Expected: Manifest contains:
- `"permissions": ["storage"]`
- `"host_permissions": ["<all_urls>"]`
- `"content_scripts"` with `matches: ["<all_urls>"]`
- `"options_ui"` or `"options_page"` entry

- [ ] **Step 4: Verify file structure matches plan**

```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" -o -name "*.html" -o -name "*.json" \) ! -path "./node_modules/*" ! -path "./.output/*" ! -path "./.wxt/*" | sort
```

Expected output:
```
./components/LoadingSpinner.tsx
./components/WordPopup.tsx
./entrypoints/content.ts
./entrypoints/options/App.tsx
./entrypoints/options/index.html
./entrypoints/options/main.tsx
./hooks/useWordMeaning.ts
./package.json
./styles/popup.css
./styles/popup.css.d.ts
./tsconfig.json
./utils/deepseek.ts
./utils/storage.ts
./utils/wordExtractor.ts
./wxt.config.ts
```

---

## Verification Checklist

Before marking complete:
- [ ] `pnpm build` succeeds with zero errors
- [ ] `.output/chrome-mv3/manifest.json` has correct permissions
- [ ] Content script is bundled and present in output
- [ ] Options page HTML/JS is present in output
- [ ] Shadow DOM CSS is included in content script bundle
- [ ] Extension loads in Chrome via `chrome://extensions` → "Load unpacked"
- [ ] Clicking a word on any webpage shows the popup
- [ ] Popup shows loading state → definition (with valid API key)
- [ ] Popup shows "配置 API Key" message (without valid API key)
- [ ] Clicking outside popup dismisses it
- [ ] Options page saves and loads API key correctly
