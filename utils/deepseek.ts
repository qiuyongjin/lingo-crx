// utils/deepseek.ts

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT = `你是词典助手。使命：让用户看懂单词在语境中的含义和用法。

根据用户输入，以固定JSON格式返回结果。

## 用户提供句子时（{}标记目标词）
1. 从原文提取包含该词的短语/搭配
2. 给出该词在此语境下的中文释义
3. 翻译整个短语

JSON格式：
{"meaning":"单词在语境中的中文释义","phrase":"原文短语","phraseMeaning":"短语的中文翻译"}

## 用户仅提供单词时
只需返回 meaning 字段，phrase 和 phraseMeaning 可省略。

JSON格式：
{"meaning":"常见中文释义"}

仅输出JSON，不要任何解释或额外文字。`;

export interface ContextualMeaning {
  meaning: string;
  phrase: string;
  phraseMeaning: string;
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

/** Strip markdown code fences from LLM JSON output. Handles \r\n, optional newlines. */
function stripJsonFences(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export async function fetchDefinition(
  word: string,
  apiKey: string,
  sentence?: string | null,
  signal?: AbortSignal
): Promise<FetchDefinitionResult> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: sentence ? `句子: ${sentence}` : `查词: ${word}` },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        word,
        error: `API 请求失败 (${response.status}): ${errorText}`,
        code: "API_ERROR",
      };
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return { word, meaning: { meaning: "未找到释义", phrase: "", phraseMeaning: "" } };
    }

    const json = stripJsonFences(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return {
        word,
        error: "解析释义失败，请重试",
        code: "API_ERROR",
      };
    }

    // Reject primitives and arrays — we expect a JSON object
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        word,
        error: "解析释义失败，请重试",
        code: "API_ERROR",
      };
    }

    const obj = parsed as Record<string, unknown>;
    return {
      word,
      meaning: {
        meaning: typeof obj.meaning === "string" ? obj.meaning : "未找到释义",
        phrase: typeof obj.phrase === "string" ? obj.phrase : "",
        phraseMeaning: typeof obj.phraseMeaning === "string" ? obj.phraseMeaning : "",
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { word, error: "请求已取消", code: "NETWORK_ERROR" };
    }
    const message =
      err instanceof TypeError && err.message === "Failed to fetch"
        ? "网络连接失败，请检查网络"
        : `请求出错: ${err instanceof Error ? err.message : String(err)}`;
    return { word, error: message, code: "NETWORK_ERROR" };
  }
}
