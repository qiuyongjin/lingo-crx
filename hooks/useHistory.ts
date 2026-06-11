import { useState, useEffect, useCallback } from "react";
import {
  getHistory,
  addHistoryItem,
  clearHistory,
  type HistoryItem,
} from "../utils/historyStorage";

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    getHistory().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  // Listen for changes from other contexts (e.g., content script writes)
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (changes["lingo-history"]) {
        getHistory().then((data) => setItems(data));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const addItem = useCallback(async (word: string, context: string) => {
    await addHistoryItem(word, context);
    // Reload to get deduped/pruned list
    const updated = await getHistory();
    setItems(updated);
  }, []);

  const clearAll = useCallback(async () => {
    await clearHistory();
    setItems([]);
  }, []);

  const reload = useCallback(async () => {
    const updated = await getHistory();
    setItems(updated);
  }, []);

  return { items, loading, addItem, clearAll, reload } as const;
}
