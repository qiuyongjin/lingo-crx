// utils/deepseek.ts

import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是词典助手。给出单词的中文释义。

## 用户提供句子时（{}标记目标词）
根据上下文给出该词的中文释义。

## 用户仅提供单词时
给出常见中文释义。

JSON格式：
{"meaning":"中文释义"}

仅输出JSON，不要任何解释或额外文字。`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextualMeaning {
  meaning: string;
}

export interface DefinitionResult {
  word: string;
  meaning: ContextualMeaning;
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

/** Strip markdown code fences from LLM JSON output. */
function stripJsonFences(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

/**
 * Call DeepSeek chat API and return the parsed JSON response.
 * Returns `null` when the response is empty, malformed, or not a JSON object.
 * Throws on network / API errors (handled by callers via `normalizeError`).
 */
async function chat(
  client: OpenAI,
  systemPrompt: string,
  userContent: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const response = await client.chat.completions.create(
    {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    },
    { signal },
  );

  const raw = response.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  const cleaned = stripJsonFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* JSON parse failed — treat as empty response */
  }
  return null;
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
    const data = await chat(
      client,
      SYSTEM_PROMPT,
      sentence || `查词: ${word}`,
      signal,
    );

    if (!data) {
      return {
        word,
        error: "解析释义失败，请重试",
        code: "API_ERROR",
      };
    }

    return {
      word,
      meaning: {
        meaning: typeof data.meaning === "string" ? data.meaning : "未找到释义",
      },
    };
  } catch (err) {
    return { word, ...normalizeError(err) };
  }
}

