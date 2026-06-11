export default defineBackground(() => {
  let activeSidePanelTabId: number | null = null;

  // Handle FAB clicks — open side panel and notify content script
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "openSidePanel" && sender.tab?.id != null) {
      const newTabId = sender.tab.id;

      // Notify previous tab that its panel is no longer showing
      if (activeSidePanelTabId != null && activeSidePanelTabId !== newTabId) {
        chrome.tabs.sendMessage(activeSidePanelTabId, {
          type: "sidePanelState",
          open: false,
        }).catch(() => {});
      }

      activeSidePanelTabId = newTabId;
      chrome.sidePanel.open({ tabId: newTabId }).catch(() => {});
      chrome.tabs.sendMessage(newTabId, {
        type: "sidePanelState",
        open: true,
      }).catch(() => {});
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
