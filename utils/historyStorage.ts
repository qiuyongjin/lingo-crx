// utils/historyStorage.ts

export interface HistoryItem {
  word: string;
  context: string;
  timestamp: number;
}

const STORAGE_KEY = "lingo-history";
const MAX_ITEMS = 500;

function dedupeAndPrune(items: HistoryItem[]): HistoryItem[] {
  // Dedupe by word+context, keeping latest timestamp
  const seen = new Map<string, HistoryItem>();
  for (const item of items) {
    const key = `${item.word}::${item.context}`;
    const existing = seen.get(key);
    if (!existing || item.timestamp > existing.timestamp) {
      seen.set(key, item);
    }
  }
  // Sort by timestamp descending, keep only MAX_ITEMS
  return Array.from(seen.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ITEMS);
}

export async function getHistory(): Promise<HistoryItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw as HistoryItem[];
}

export async function addHistoryItem(
  word: string,
  context: string,
): Promise<void> {
  const items = await getHistory();
  items.push({ word, context, timestamp: Date.now() });
  const pruned = dedupeAndPrune(items);
  await chrome.storage.local.set({ [STORAGE_KEY]: pruned });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
