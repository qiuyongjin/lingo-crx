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

const SYSTEM_PROMPT = `你是词典助手。用精炼的表达，让英语小白也能轻松理解并记住目标单词。不要长篇大论。

## 核心原则
- 不要只丢一个释义就走——要让人看完脑子里有画面、能记住
- 用生活中常见的具体场景来解释，不要词典腔
- 像给朋友随口讲一个词那样自然

## 输出格式
- 不输出英文、不输出 markdown 标记（标题、列表符号除外）
- 合理使用换行分隔不同内容，让结构一目了然

## 用户仅提供单词时
分两行输出：
第一行：最常见的中文释义
第二行：一个简短的生活场景，让这个词变立体

## 用户提供句子时（{} 标记目标词）
句子中目标单词用 {} 标记（如 "I like {apples}"）。
分三部分输出，每部分之间空一行：

1. 该词在此处的意思
2. 一个类似的场景，帮用户举一反三
3. 简单回顾原句，帮用户理解整句话在说什么`;

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

