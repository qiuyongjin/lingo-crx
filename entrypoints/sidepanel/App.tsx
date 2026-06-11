// entrypoints/sidepanel/App.tsx

import { useEffect } from "react";
import { useHistory } from "../../hooks/useHistory";
import { HistoryPanel } from "../../components/HistoryPanel";
import "../../styles/history.scss";

export function App() {
  const { items, loading } = useHistory();

  // Connect a long-lived port so the background can detect when the
  // side panel closes (port disconnects when the page is destroyed).
  useEffect(() => {
    const port = chrome.runtime.connect({ name: "sidepanel" });

    // Listen for close request from background (e.g., keyboard shortcut toggle)
    const closeListener = (message: any) => {
      if (message.type === "closeSidePanel") {
        window.close();
      }
    };
    chrome.runtime.onMessage.addListener(closeListener);

    return () => {
      port.disconnect();
      chrome.runtime.onMessage.removeListener(closeListener);
    };
  }, []);

  return (
    <HistoryPanel
      items={items}
      loading={loading}
    />
  );
}
