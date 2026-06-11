# Side Panel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate history panel from fixed-position drawer (content script Shadow DOM) to Chrome Side Panel API for zero page occlusion.

**Architecture:** The FloatingButton stays in the content script (page context) and sends a `chrome.runtime.sendMessage` on click. The background script receives it and calls `chrome.sidePanel.open()`. The HistoryPanel lives in a new `sidepanel` entrypoint as a standalone React app, using `chrome.storage.onChanged` for live sync.

**Tech Stack:** WXT v0.20, React 19, SCSS, Chrome Side Panel API (Chrome 114+)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `wxt.config.ts` | Add `"sidePanel"` permission |
| Create | `entrypoints/sidepanel/index.html` | HTML shell for side panel page |
| Create | `entrypoints/sidepanel/main.tsx` | React mount point |
| Create | `entrypoints/sidepanel/App.tsx` | Root component: useHistory + HistoryPanel |
| Modify | `hooks/useHistory.ts` | Add `chrome.storage.onChanged` listener |
| Modify | `components/HistoryPanel.tsx` | Make `onClose` optional; hide overlay/close btn when absent |
| Modify | `styles/history.scss` | Remove overlay/root/fixed-panel styles; panel becomes natural block |
| Modify | `entrypoints/background.ts` | Add `runtime.onMessage` listener for `openSidePanel` |
| Modify | `entrypoints/content.tsx` | Remove HistoryApp/HistoryPanel; FAB standalone, click → sendMessage |
| Delete | `components/HistoryApp.tsx` | No longer needed (FAB + Panel are separate contexts) |

---

### Task 1: Add `"sidePanel"` permission

**Files:**
- Modify: `wxt.config.ts:10`

- [ ] **Step 1: Add `"sidePanel"` to manifest permissions**

```ts
// wxt.config.ts — line 10
permissions: ["storage", "sidePanel"],
```

- [ ] **Step 2: Build to verify config is valid**

```bash
pnpm build
```

Expected: Build succeeds. The generated `dist/chrome-mv3/manifest.json` should include `"sidePanel"` in `permissions` and WXT auto-generates the `side_panel` key once the entrypoint exists (Task 2).

- [ ] **Step 3: Commit**

```bash
git add wxt.config.ts
git commit -m "chore: add sidePanel permission"
```

---

### Task 2: Create side panel entrypoint

**Files:**
- Create: `entrypoints/sidepanel/index.html`
- Create: `entrypoints/sidepanel/main.tsx`
- Create: `entrypoints/sidepanel/App.tsx`

- [ ] **Step 1: Create `entrypoints/sidepanel/index.html`**

Following the same pattern as `entrypoints/options/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lingo 查词历史</title>
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

- [ ] **Step 2: Create `entrypoints/sidepanel/main.tsx`**

```tsx
// entrypoints/sidepanel/main.tsx

import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

- [ ] **Step 3: Create `entrypoints/sidepanel/App.tsx`**

```tsx
// entrypoints/sidepanel/App.tsx

import { useHistory } from "../../hooks/useHistory";
import { HistoryPanel } from "../../components/HistoryPanel";
import "../../styles/history.scss";

export function App() {
  const { items, loading } = useHistory();

  return (
    <HistoryPanel
      items={items}
      loading={loading}
    />
  );
}
```

Note: `onClose` is not passed — HistoryPanel will hide the overlay and close button when the prop is absent (Task 4).

- [ ] **Step 4: Build and verify entrypoint is generated**

```bash
pnpm build
```

Expected: Build succeeds. Check that `dist/chrome-mv3/sidepanel.html` exists. The `manifest.json` should now include a `side_panel` key with `default_path: "sidepanel.html"`.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/
git commit -m "feat: add side panel entrypoint"
```

---

### Task 3: Add `storage.onChanged` listener to `useHistory`

**Files:**
- Modify: `hooks/useHistory.ts:13-19`

- [ ] **Step 1: Replace the mount-load with load + onChanged listener**

Current (lines 13-19):
```ts
// Load history on mount
useEffect(() => {
  getHistory().then((data) => {
    setItems(data);
    setLoading(false);
  });
}, []);
```

Replace with:
```ts
// Load history on mount
useEffect(() => {
  getHistory().then((data) => {
    setItems(data);
    setLoading(false);
  });
}, []);

// Listen for changes from other contexts (e.g., content script writes)
useEffect(() => {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
  ) => {
    if (changes["lingo-history"]) {
      getHistory().then((data) => setItems(data));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}, []);
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add hooks/useHistory.ts
git commit -m "feat: add storage.onChanged listener to useHistory for cross-context sync"
```

---

### Task 4: Make `HistoryPanel.onClose` optional

**Files:**
- Modify: `components/HistoryPanel.tsx:5,8,31,43-63`

- [ ] **Step 1: Make `onClose` optional in props interface**

```tsx
// components/HistoryPanel.tsx — line 5
interface HistoryPanelProps {
  items: HistoryItem[];
  loading: boolean;
  onClose?: () => void;  // optional — absent in side panel context
}
```

- [ ] **Step 2: Conditionally render overlay**

Replace line 31:
```tsx
{/* Backdrop overlay — click to dismiss */}
<div className="lingo-history-overlay" onClick={onClose} />
```

With:
```tsx
{/* Backdrop overlay — click to dismiss (only when onClose is provided) */}
{onClose && <div className="lingo-history-overlay" onClick={onClose} />}
```

- [ ] **Step 3: Conditionally render close button**

Replace lines 43-63 (the close button `<button>`):
```tsx
<button
  className="lingo-history-header-close"
  onClick={onClose}
  title="关闭"
  aria-label="关闭历史面板"
>
  <svg ...>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
</button>
```

With:
```tsx
{onClose && (
  <button
    className="lingo-history-header-close"
    onClick={onClose}
    title="关闭"
    aria-label="关闭历史面板"
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
)}
```

- [ ] **Step 4: Build to verify**

```bash
pnpm build
```

Expected: Build succeeds, no type errors about `onClose` being required.

- [ ] **Step 5: Commit**

```bash
git add components/HistoryPanel.tsx
git commit -m "feat: make HistoryPanel onClose optional for side panel usage"
```

---

### Task 5: Simplify `history.scss` for side panel layout

**Files:**
- Modify: `styles/history.scss`

- [ ] **Step 1: Remove overlay styles**

Remove lines 93-99:
```scss
// ── Panel Overlay (click to dismiss) ───────────────────────────

.lingo-history-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  animation: lingo-history-fade-in $fade-duration ease-out;
}
```

- [ ] **Step 2: Remove root wrapper styles**

Remove lines 41-51:
```scss
// ── Wrapper (covers full viewport so panel background overlay works) ─

.lingo-history-root {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 99998;
  font-family: $font-family-system;
  line-height: $line-height-base;
}
```

- [ ] **Step 3: Remove animations**

Remove lines 215-231 (both keyframes):
```scss
// ── Animations ─────────────────────────────────────────────────

@keyframes lingo-history-slide-in { ... }
@keyframes lingo-history-fade-in { ... }
```

- [ ] **Step 4: Change `.lingo-history-panel` from fixed drawer to natural block**

Replace lines 103-116:
```scss
.lingo-history-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: $panel-width;
  height: 100vh;
  background: $color-bg;
  box-shadow: -2px 0 12px $color-shadow;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  animation: lingo-history-slide-in 0.25s ease-out;
  z-index: 1;
}
```

With:
```scss
.lingo-history-panel {
  width: 100%;
  height: 100vh;
  background: $color-bg;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 5: Remove unused `$panel-width` variable**

Remove line 30:
```scss
$panel-width:           320px;
```

(No longer referenced after the panel styles change.)

- [ ] **Step 6: Build to verify**

```bash
pnpm build
```

Expected: Build succeeds. SCSS compiles without errors.

- [ ] **Step 7: Commit**

```bash
git add styles/history.scss
git commit -m "refactor: simplify history.scss for side panel (remove overlay/root/animations)"
```

---

### Task 6: Add message listener to background script

**Files:**
- Modify: `entrypoints/background.ts:1-3`

- [ ] **Step 1: Replace the background stub with message handler**

Replace the entire file:
```ts
export default defineBackground(() => {
  // Minimal background script — required by WXT to have at least one entrypoint
});
```

With:
```ts
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "openSidePanel" && sender.tab?.id != null) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {
        // Tab may not support side panels (e.g., chrome:// pages) — no-op
      });
    }
  });
});
```

- [ ] **Step 2: Build to verify**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: add sidePanel.open message handler to background"
```

---

### Task 7: Refactor content script — FAB standalone

**Files:**
- Modify: `entrypoints/content.tsx`
- Delete: `components/HistoryApp.tsx`

- [ ] **Step 1: Update imports**

Remove `HistoryApp` import (line 7):
```ts
import { HistoryApp } from "../components/HistoryApp";
```

Keep `FloatingButton` import — add if not already present. Currently `FloatingButton` is not directly imported in content.tsx; it's used inside `HistoryApp`. Add:
```ts
import { FloatingButton } from "../components/FloatingButton";
```

Keep `historyCss` import (line 13) — still needed for FAB styles in the Shadow DOM:
```ts
import historyCss from "../styles/history.scss?inline";
```

- [ ] **Step 2: Replace `mountHistorySystem()` with `mountFloatingButton()`**

Replace lines 29-53:
```ts
function mountHistorySystem() {
  if (historyContainer) return; // already mounted

  historyContainer = document.createElement("div");
  historyContainer.style.position = "absolute";
  historyContainer.style.top = "0";
  historyContainer.style.left = "0";
  historyContainer.style.width = "0";
  historyContainer.style.height = "0";
  historyContainer.style.zIndex = "999998";

  const shadowRoot = historyContainer.attachShadow({ mode: "closed" });

  const styleEl = document.createElement("style");
  styleEl.textContent = historyCss;
  shadowRoot.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  shadowRoot.appendChild(mountPoint);

  document.body.appendChild(historyContainer);

  historyRoot = createRoot(mountPoint);
  historyRoot.render(<HistoryApp />);
}
```

With:
```ts
function mountFloatingButton() {
  if (historyContainer) return; // already mounted

  historyContainer = document.createElement("div");
  historyContainer.style.position = "absolute";
  historyContainer.style.top = "0";
  historyContainer.style.left = "0";
  historyContainer.style.width = "0";
  historyContainer.style.height = "0";
  historyContainer.style.zIndex = "999998";

  const shadowRoot = historyContainer.attachShadow({ mode: "closed" });

  const styleEl = document.createElement("style");
  styleEl.textContent = historyCss;
  shadowRoot.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  shadowRoot.appendChild(mountPoint);

  document.body.appendChild(historyContainer);

  historyRoot = createRoot(mountPoint);
  historyRoot.render(
    <FloatingButton
      onClick={() => {
        chrome.runtime.sendMessage({ type: "openSidePanel" }).catch(() => {
          // Background may not be ready — no-op
        });
      }}
    />,
  );
}
```

- [ ] **Step 3: Update `historyRoot` type**

The variable `historyRoot` is currently typed as `ReturnType<typeof createRoot> | null` (line 27). This stays the same — we still use `createRoot` for the FAB.

- [ ] **Step 4: Replace `mountHistorySystem()` call**

Replace line 291:
```ts
// Mount history system (floating button + slide-in panel)
mountHistorySystem();
```

With:
```ts
// Mount floating button (opens side panel via background message)
mountFloatingButton();
```

- [ ] **Step 5: Remove `historyContainer?.contains()` in Alt-key check**

Lines 283-284 currently check:
```ts
const el = document.elementFromPoint(mouseX, mouseY);
if (historyContainer?.contains(el)) return;
```

This check is still valid — it prevents the Ctrl-key lookup from firing when the user clicks the FAB. Keep it as-is. No change needed.

- [ ] **Step 6: Delete `components/HistoryApp.tsx`**

```bash
rm components/HistoryApp.tsx
```

No other files import `HistoryApp` — `content.tsx` was the only consumer.

- [ ] **Step 7: Build to verify**

```bash
pnpm build
```

Expected: Build succeeds. No unused import errors.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/content.tsx components/HistoryApp.tsx
git commit -m "refactor: replace HistoryApp with standalone FAB, trigger sidebar via message"
```

---

### Task 8: End-to-end build verification

- [ ] **Step 1: Clean build**

```bash
pnpm build
```

Expected: Build succeeds with no errors or warnings.

- [ ] **Step 2: Verify generated manifest**

```bash
cat dist/chrome-mv3/manifest.json | python3 -m json.tool
```

Expected: Manifest includes:
- `"permissions": ["storage", "sidePanel"]`
- `"side_panel": { "default_path": "sidepanel.html" }`

- [ ] **Step 3: Verify generated sidepanel.html exists**

```bash
ls -la dist/chrome-mv3/sidepanel.html
```

Expected: File exists and contains the side panel HTML.

- [ ] **Step 4: Load extension in Chrome and smoke test**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/chrome-mv3`
4. Navigate to any webpage (e.g., `https://en.wikipedia.org`)
5. Verify the FAB appears on the right side (semi-hidden, reveals on hover)
6. Click the FAB → verify the side panel opens with the history list
7. Click a word on the page → verify the popup appears and the word is added to history
8. Verify the new entry appears in the side panel without closing/reopening
9. Verify the FAB remains visible when the side panel is open
10. Close the side panel via the browser's X button → verify FAB still works

- [ ] **Step 5: Commit (if any fixes were needed)**

If fixes were made during smoke testing:
```bash
git add -A
git commit -m "fix: smoke test corrections for side panel migration"
```

---

## Verification Checklist

- [ ] `pnpm build` passes cleanly
- [ ] `manifest.json` includes `"sidePanel"` permission and `"side_panel"` key
- [ ] `dist/chrome-mv3/sidepanel.html` exists
- [ ] FAB appears on web pages and is draggable
- [ ] FAB click opens the side panel
- [ ] Side panel shows history items
- [ ] New word lookups appear in the side panel without manual refresh
- [ ] FAB remains visible when side panel is open
- [ ] Side panel can be closed via browser X button
- [ ] Word popup still works correctly (unaffected by this change)
- [ ] No `HistoryApp` references remain in the codebase
