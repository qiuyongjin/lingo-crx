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
    return () => port.disconnect();
  }, []);

  return (
    <HistoryPanel
      items={items}
      loading={loading}
    />
  );
}
