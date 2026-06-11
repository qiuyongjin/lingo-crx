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

  return { items, loading, addItem, clearAll } as const;
}
