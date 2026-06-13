import { cacheDictionaryEntry, fetchCachedDictionary } from "../utils/dictionaryCache";

export default defineBackground(() => {
  let activeSidePanelTabId: number | null = null;
  // Track active tab proactively so command handler can stay synchronous
  // and preserve the user gesture required by chrome.sidePanel.open().
  let currentTabId: number | null = null;

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    currentTabId = tabId;
  });
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id != null) currentTabId = tab.id;
  });

  function openSidePanel(tabId: number) {
    // Notify previous tab that its panel is no longer showing
    if (activeSidePanelTabId != null && activeSidePanelTabId !== tabId) {
      chrome.tabs.sendMessage(activeSidePanelTabId, {
        type: "sidePanelState",
        open: false,
      }).catch(() => {});
    }

    activeSidePanelTabId = tabId;
    chrome.sidePanel.open({ tabId }).catch(() => {});
    chrome.tabs.sendMessage(tabId, {
      type: "sidePanelState",
      open: true,
    }).catch(() => {});
  }

  // Handle FAB clicks — open side panel and notify content script
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "openSidePanel" && sender.tab?.id != null) {
      openSidePanel(sender.tab.id);
    }
  });

  // Handle keyboard shortcut — toggle side panel via chrome.commands.
  // Must be synchronous (no await) to preserve the user gesture so
  // chrome.sidePanel.open() succeeds.
  chrome.commands.onCommand.addListener((command) => {
    if (command !== "toggle-side-panel") return;
    if (currentTabId == null) return;

    if (activeSidePanelTabId === currentTabId) {
      // Side panel is already open for this tab — close it
      chrome.runtime.sendMessage({ type: "closeSidePanel" }).catch(() => {});
    } else {
      openSidePanel(currentTabId);
    }
  });

  // --- Youdao dictionary proxy ---
  // Content scripts can't always reach dict.youdao.com directly (403 if the
  // server checks Origin/Referer). Proxy through the service worker instead.

  /**
   * Fetch with automatic retry on transient failures.
   *
   * Retries on: network errors (ERR_EMPTY_RESPONSE, connection refused, etc.),
   * 5xx server errors, 429 rate limits, and empty 200 responses.
   *
   * Does NOT retry on: 4xx client errors (including 403 anti-crawl blocks).
   */
  async function fetchWithRetry(
    url: string,
    maxRetries = 2,
  ): Promise<any> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url);

        // 4xx client errors — won't succeed on retry
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          return null;
        }

        if (!res.ok) {
          // 5xx or 429 — will retry below
          throw new Error(`HTTP ${res.status}`);
        }

        const text = await res.text();
        if (!text) {
          // Empty body on 200 — treat as transient
          throw new Error("Empty response body");
        }

        return JSON.parse(text);
      } catch (err) {
        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt) return null;

        // Wait with exponential backoff before retrying
        const delay = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "fetchYoudao") {
      const word = message.word as string;
      fetchYoudaoWithCache(word)
        .then((result) => sendResponse({ data: result.data, fromCache: result.fromCache }))
        .catch(() => sendResponse({ data: null, fromCache: false }));
      return true; // keep the message channel open for async response
    }
  });

  /**
   * Cache-first Youdao lookup:
   * 1. Try the Lingo cache server first
   * 2. On cache hit, return immediately
   * 3. On cache miss, fetch from Youdao and cache the result
   */
  async function fetchYoudaoWithCache(
    word: string,
  ): Promise<{ data: any; fromCache: boolean }> {
    // 1. Try cache
    const cached = await fetchCachedDictionary(word, "en", "zh");
    if (cached) return { data: cached, fromCache: true };

    // 2. Cache miss — fetch from Youdao
    const data = await fetchWithRetry(
      `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`,
    );

    // 3. Cache the result for next time (fire-and-forget)
    if (data) {
      cacheDictionaryEntry(word, "en", "zh", data);
      return { data, fromCache: true };
    }

    return { data, fromCache: false };
  }

  // Track side panel lifecycle via long-lived port.
  // The port auto-disconnects when the panel page is destroyed (closed).
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "sidepanel") {
      const tabIdForThisPort = activeSidePanelTabId;
      port.onDisconnect.addListener(() => {
        if (tabIdForThisPort != null) {
          chrome.tabs.sendMessage(tabIdForThisPort, {
            type: "sidePanelState",
            open: false,
          }).catch(() => {});
        }
        if (activeSidePanelTabId === tabIdForThisPort) {
          activeSidePanelTabId = null;
        }
      });
    }
  });
});
