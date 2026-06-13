// utils/deepseek.ts

import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是词典助手。用精炼的表达，让英语初学者也能轻松理解并记住目标单词。最多 3 句话。

## 核心原则
- 不要只给释义——要让人看完脑子里有具体画面、能记住
- 场景必须包含具体的人、事或情绪，不能泛泛而谈
- 像给朋友随口讲一个词那样自然

## 什么是好场景 vs 坏场景
坏：apple - 苹果。常见于水果店和超市。
好：apple - 苹果。你咬一口红富士，嘎嘣脆、满嘴甜汁——就是这种感觉。

## 输出格式
- 不输出 markdown 标记（##、**、\` 等）
- 尽量用中文，但固定搭配可保留英文（如 "take a nap 表示小睡一会"）
- 用换行分隔不同内容，结构清晰

## 用户仅提供单词时
- 最常见中文释义
- 一个让人有画面感的场景

## 用户提供句子时（{} 标记目标词）
句子中目标单词用 {} 标记（如 "I like {apples}"），按顺序输出：
- 该词在此处的意思
- 一个类似的具体场景，帮用户举一反三
- （可选）简单回顾原句，帮用户理解整句在说什么`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DefinitionResult {
  word: string;
  meaning: string;
}

export interface DefinitionError {
  word: string;
  error: string;
  code: "NO_API_KEY" | "API_ERROR" | "NETWORK_ERROR";
}

export type FetchDefinitionResult = DefinitionResult | DefinitionError;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Create an OpenAI client configured for DeepSeek API. */
function createClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

/**
 * Call DeepSeek chat API and return the response text.
 * Returns `null` when the response is empty.
 * Throws on network / API errors (handled by callers via `normalizeError`).
 */
async function chat(
  client: OpenAI,
  systemPrompt: string,
  userContent: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await client.chat.completions.create(
    {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
    },
    { signal },
  );

  const raw = response.choices?.[0]?.message?.content?.trim();
  return raw || null;
}

/**
 * Stream DeepSeek chat API response as text deltas.
 * Yields each text chunk as it arrives. Throws on network / API errors.
 */
async function* chatStream(
  client: OpenAI,
  systemPrompt: string,
  userContent: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create(
    {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      stream: true,
    },
    { signal },
  );

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * Normalize a thrown error into `{ error, code }`.
 * Handles AbortError, OpenAI APIError, and generic network errors.
 */
function normalizeError(
  err: unknown,
): { error: string; code: "API_ERROR" | "NETWORK_ERROR" } {
  // User-aborted request
  if (err instanceof DOMException && err.name === "AbortError") {
    return { error: "请求已取消", code: "NETWORK_ERROR" };
  }

  // OpenAI SDK APIError (non-2xx response)
  if (err && typeof err === "object" && "status" in err) {
    const apiErr = err as { status: number; message?: string };
    return {
      error: `API 请求失败 (${apiErr.status}): ${apiErr.message ?? "Unknown error"}`,
      code: "API_ERROR",
    };
  }

  // Network connectivity
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return { error: "网络连接失败，请检查网络", code: "NETWORK_ERROR" };
  }

  // Unknown error
  return {
    error: `请求出错: ${err instanceof Error ? err.message : String(err)}`,
    code: "NETWORK_ERROR",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export { normalizeError };

/**
 * Fetch word definition from DeepSeek.
 * When `sentence` is provided the word's contextual meaning is included.
 */
export async function fetchDefinition(
  word: string,
  apiKey: string,
  sentence?: string | null,
  signal?: AbortSignal,
): Promise<FetchDefinitionResult> {
  const client = createClient(apiKey);

  try {
    const text = await chat(
      client,
      SYSTEM_PROMPT,
      sentence || `查词: ${word}`,
      signal,
    );

    if (!text) {
      return {
        word,
        error: "解析释义失败，请重试",
        code: "API_ERROR",
      };
    }

    return {
      word,
      meaning: text,
    };
  } catch (err) {
    return { word, ...normalizeError(err) };
  }
}

/**
 * Stream word definition from DeepSeek.
 * Yields text chunks as they arrive. The caller accumulates them for progressive display.
 * Throws on API/network errors — callers should wrap in try/catch and call `normalizeError`.
 */
export async function* fetchDefinitionStream(
  word: string,
  apiKey: string,
  sentence?: string | null,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const client = createClient(apiKey);
  yield* chatStream(client, SYSTEM_PROMPT, sentence || `查词: ${word}`, signal);
}

