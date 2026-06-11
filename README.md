# Lingo

[中文](README_CN.md)

Click any word on a webpage to see its Chinese definition in a floating popup.

## Features

- **Click to define** — Hold Alt/Option and click any word on any page, definition pops up instantly
- **Ctrl-key lookup** — Alternatively, press and release Ctrl at the cursor position to look up the word underneath
- **AI-powered** — Accurate, concise definitions from DeepSeek, with phonetic transcription and contextual examples
- **Sentence breakdown** — Each sentence is split into clause-level segments with individual translations
- **Text-to-speech** — Click the speaker icon to hear pronunciation; optionally auto-speak on every lookup
- **Lookup history** — Every looked-up word is saved with context; view in the side panel
- **Floating action button** — A draggable FAB on the right edge of every page opens the history side panel
- **Quick settings** — Toggle Alt-key requirement and auto-speak directly from the popup

## Setup

### 1. Install

1. Download the `dist/chrome-mv3/` folder
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `dist/chrome-mv3/` folder

### 2. Configure API Key

1. Get an API Key from [DeepSeek Platform](https://platform.deepseek.com/api_keys)
2. Right-click the extension icon → Options
3. Paste your API Key and click Save

### 3. Use

- **Option+Click** any word on any webpage — the definition appears instantly
- **Ctrl** — press and release Ctrl while hovering over a word to look it up
- **Click outside** the popup or press Escape to dismiss
- **FAB** — click the blue button on the right edge to open lookup history in the side panel; drag it vertically to reposition
- **Speaker** — click the speaker icon in the popup to hear pronunciation
- **Gear** — click the gear icon to toggle settings (Alt-key requirement, auto-speak)

## Build from Source

```bash
pnpm install
pnpm build
# Output: dist/chrome-mv3/
```
