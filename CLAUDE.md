# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install        # Install dependencies (runs wxt prepare postinstall)
pnpm dev            # Dev mode with HMR, opens Chrome
pnpm build          # Production build → dist/chrome-mv3/
```

There are no tests or linter configured.

After modifying code, always run `pnpm build` to rebuild the extension.

## Architecture

This is a Chrome extension (Manifest V3) built with **WXT**. It has two entrypoints:

- **Content script** (`entrypoints/content.tsx`) — Injected into every page. Listens for clicks, extracts the word at cursor, mounts a React popup inside a manually-created Shadow DOM, calls DeepSeek API, shows the definition.
- **Options page** (`entrypoints/options/`) — React app where users configure their DeepSeek API key, stored in `chrome.storage.sync`.

The background script (`entrypoints/background.ts`) is a minimal stub required by WXT; it does nothing.

## Key Design Decisions

**Manual Shadow DOM instead of WXT's `createShadowRootUi`.** The popup needs pixel-precise absolute positioning below the clicked word. WXT's built-in UI helpers don't support this, so the content script manually creates a zero-size `<div>`, attaches a Shadow DOM, positions the popup with `position: fixed`, and mounts React via `createRoot`.

**CSS is imported as a raw string** (`popup.css?inline`) and injected into the Shadow DOM via a `<style>` element. This provides complete style isolation from the host page.

**`content.tsx` must use the `.tsx` extension** because it contains inline JSX (the `PopupApp` component). A `.ts` extension will fail to build with JSX parse errors.

## Data Flow

1. User clicks on page → `content.tsx` captures `click` event (useCapture phase)
2. `extractWordFromPoint(clientX, clientY)` uses `document.caretRangeFromPoint` to locate the text node, then expands to word boundaries
3. `useWordMeaning.lookup(word)` reads API key from `chrome.storage.sync`, POSTs to DeepSeek
4. `WordPopup` renders one of four states: `loading` | `result` | `error` | `no-api-key`
5. Clicking outside the popup → `unmountPopup()` removes the Shadow DOM and React root

## Static Assets

Files in `public/` are copied to the extension root at build time. Icons live at `public/icons/` and are referenced in `wxt.config.ts` manifest as `icons/icon-NN.png`.
