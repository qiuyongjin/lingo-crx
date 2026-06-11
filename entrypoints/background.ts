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
