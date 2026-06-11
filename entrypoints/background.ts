export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "openSidePanel" && sender.tab?.id != null) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {
        // Tab may not support side panels (e.g., chrome:// pages) — no-op
      });
    }
  });
});
