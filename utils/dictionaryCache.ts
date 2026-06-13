// utils/dictionaryCache.ts — Lingo dictionary cache server client

const CACHE_API_URL = "https://api.yourhero.cn/lingo/dictionary";
const CACHE_API_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6bnVsbCwic3ViIjoyLCJpYXQiOjE3NjEzOTYxNzIsImV4cCI6MTc2MTM5NjIzMn0.sbjL9gJ5DhCf5neMg6e12SXM2lWdFzvPExrL4MvTCug";

const headers = {
  Authorization: `Bearer ${CACHE_API_TOKEN}`,
};

interface CacheEntry {
  id: string;
  word: string;
  sourceLanguage: string;
  targetLanguage: string;
  data: object; // raw Youdao API response
  status: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Try to fetch a cached dictionary entry.
 * Returns the raw Youdao response data on cache hit, or `null` on miss / error.
 */
export async function fetchCachedDictionary(
  word: string,
  sourceLanguage = "en",
  targetLanguage = "zh",
): Promise<object | null> {
  const url = `${CACHE_API_URL}?word=${encodeURIComponent(word)}&sourceLanguage=${sourceLanguage}&targetLanguage=${targetLanguage}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const body = await res.json();
    // Response: { code: 200, data: [CacheEntry, ...], message: "OK" }
    if (body?.code !== 200 || !Array.isArray(body?.data)) return null;

    const entry = body.data[0] as CacheEntry | undefined;
    // An entry with empty `data` means the word was looked up but Youdao
    // returned nothing — treat as miss so we retry Youdao.
    if (!entry || !entry.data || Object.keys(entry.data).length === 0) {
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Cache a dictionary entry to the Lingo dictionary server.
 * Fire-and-forget — failures are silently ignored.
 */
export async function cacheDictionaryEntry(
  word: string,
  sourceLanguage: string,
  targetLanguage: string,
  data: object,
): Promise<void> {
  const body = new URLSearchParams({
    word,
    sourceLanguage,
    targetLanguage,
    data: JSON.stringify(data),
  });

  try {
    await fetch(CACHE_API_URL, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch {
    // Silently ignore cache failures — don't disrupt the user experience
  }
}
