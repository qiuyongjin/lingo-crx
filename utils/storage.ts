// utils/storage.ts

const API_KEY_STORAGE_KEY = "deepseek-api-key";

export async function getApiKey(): Promise<string | undefined> {
  const result = await chrome.storage.sync.get(API_KEY_STORAGE_KEY);
  return result[API_KEY_STORAGE_KEY] as string | undefined;
}

export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.sync.set({ [API_KEY_STORAGE_KEY]: apiKey });
}

export async function onApiKeyChange(
  callback: (newKey: string | undefined) => void
): Promise<() => void> {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName === "sync" && API_KEY_STORAGE_KEY in changes) {
      callback(changes[API_KEY_STORAGE_KEY].newValue);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
