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

const SYSTEM_PROMPT = `你是词典助手。使命：让用户快速看懂单词在语境中的含义和用法。

根据用户输入，以固定JSON格式返回结果。

## 用户提供句子时（{}标记目标词）
1. 从原文提取包含该词的短语/搭配
2. 给出该词在此语境下的中文释义
3. 给出该词的国际音标(IPA)注音
4. 翻译整个短语

JSON格式：
{"meaning":"单词在语境中的中文释义","phonetic":"IPA音标，如 /ˈɪŋɡlɪʃ/","phrase":"原文短语","phraseMeaning":"短语的中文翻译"}

## 用户仅提供单词时
只需返回 meaning 和 phonetic 字段，phrase 和 phraseMeaning 可省略。

JSON格式：
{"meaning":"常见中文释义","phonetic":"IPA音标，如 /ˈɪŋɡlɪʃ/"}

仅输出JSON，不要任何解释或额外文字。`;

const SEGMENTS_PROMPT = `你是词典助手。将用户提供的原文句子拆分成若干个短句/片段（segments），每个片段给出对应的中文翻译。

JSON格式：
{"segments":[{"text":"原文片段1","translation":"中文翻译1"},{"text":"原文片段2","translation":"中文翻译2"}]}

拆分segments的规则：
- 按逗号、分号、连接词（and, but, or, so, because等）、关系代词（which, that, who等）等自然断点拆分
- 每个片段应是语法上相对完整的短语或子句
- 片段不宜过长，控制在 2-12 个单词左右
- 每个片段必须提供准确的中文翻译

仅输出JSON，不要任何解释或额外文字。`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentenceSegment {
  text: string;
  translation: string;
}

export interface ContextualMeaning {
  meaning: string;
  phonetic: string;
  phrase: string;
  phraseMeaning: string;
  segments: SentenceSegment[];
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

/** Parse segments array from a parsed JSON object. */
function parseSegments(obj: Record<string, unknown>): SentenceSegment[] {
  if (!Array.isArray(obj.segments)) return [];

  return obj.segments
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === "object" && s !== null && !Array.isArray(s),
    )
    .map((s) => ({
      text: typeof s.text === "string" ? s.text : "",
      translation: typeof s.translation === "string" ? s.translation : "",
    }))
    .filter((s) => s.text.length > 0);
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
        phonetic: typeof data.phonetic === "string" ? data.phonetic : "",
        phrase: typeof data.phrase === "string" ? data.phrase : "",
        phraseMeaning:
          typeof data.phraseMeaning === "string" ? data.phraseMeaning : "",
        segments: parseSegments(data),
      },
    };
  } catch (err) {
    return { word, ...normalizeError(err) };
  }
}

/**
 * Fetch sentence segment translations from DeepSeek.
 * Called concurrently with `fetchDefinition` for faster first paint.
 */
export async function fetchSegments(
  sentence: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<
  | { segments: SentenceSegment[] }
  | { error: string; code: "API_ERROR" | "NETWORK_ERROR" }
> {
  const client = createClient(apiKey);

  try {
    const data = await chat(client, SEGMENTS_PROMPT, sentence, signal);

    if (!data) {
      return { error: "解析分段结果失败", code: "API_ERROR" };
    }

    return { segments: parseSegments(data) };
  } catch (err) {
    return normalizeError(err);
  }
}
