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
