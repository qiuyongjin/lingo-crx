# Lingo

点击网页中的任意单词，即可在单词下方悬浮显示中文释义。

Lingo is a Chrome extension that shows brief Chinese definitions when you click any word on a webpage, powered by the DeepSeek API.

## Features

- **Click to define** — Click any word on any page to see its definition
- **AI-powered** — Definitions from DeepSeek large language model
- **Shadow DOM isolation** — Popup styles never conflict with the host page
- **Minimal & fast** — Brief one-line Chinese translations, no clutter

## Tech Stack

| Layer | Choice |
|-------|--------|
| Extension Framework | [WXT](https://wxt.dev) |
| Language | TypeScript |
| UI | React 19 |
| Styling | CSS (Shadow DOM isolated) |
| API | DeepSeek API (OpenAI-compatible) |
| Package Manager | pnpm |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- [DeepSeek API Key](https://platform.deepseek.com/api_keys)

### Install

```bash
pnpm install
```

### Develop

```bash
pnpm dev
```

This starts WXT in dev mode with HMR. Load the `dist/` directory as an unpacked extension in Chrome:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist/chrome-mv3/`

### Build

```bash
pnpm build
```

Output is in `dist/chrome-mv3/`.

### Configure

After loading the extension:

1. Go to the extension's Options page (right-click the extension icon → Options)
2. Paste your DeepSeek API Key
3. Click Save

## How It Works

```
Click a word → Extract word at cursor → Call DeepSeek API → Show popup below word
```

- Content script listens for click events on all pages
- `caretRangeFromPoint` extracts the exact word under the cursor
- Shadow DOM renders a React popup isolated from the host page
- `chrome.storage.sync` stores the API key securely
- Click anywhere outside the popup to dismiss

## Project Structure

```
src/
├── entrypoints/
│   ├── content.tsx          # Content script — click → popup
│   └── options/             # API key settings page
├── components/
│   ├── WordPopup.tsx        # Definition popup (loading/result/error)
│   └── LoadingSpinner.tsx   # Animated spinner
├── hooks/
│   └── useWordMeaning.ts    # API fetch + abort + state
├── utils/
│   ├── storage.ts           # chrome.storage wrappers
│   ├── deepseek.ts          # DeepSeek API client
│   └── wordExtractor.ts     # caretRangeFromPoint word extraction
└── styles/
    └── popup.css            # Shadow DOM isolated styles
```

## License

MIT
