// utils/deepseek.ts

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `你是词典助手。使命：让用户看懂单词在语境中的含义和用法。

根据用户输入，以固定JSON格式返回结果。

## 用户提供句子时（{}标记目标词）
1. 从原文提取包含该词的短语/搭配
2. 给出该词在此语境下的中文释义
3. 给出该词的国际音标(IPA)注音
4. 翻译整个短语
5. 将整句原文拆分成若干个短句/片段（segments），每个片段给出对应的中文翻译

JSON格式：
{"meaning":"单词在语境中的中文释义","phonetic":"IPA音标，如 /ˈɪŋɡlɪʃ/","phrase":"原文短语","phraseMeaning":"短语的中文翻译","segments":[{"text":"原文片段1","translation":"中文翻译1"},{"text":"原文片段2","translation":"中文翻译2"}]}

拆分segments的规则：
- 按逗号、分号、连接词（and, but, or, so, because等）、关系代词（which, that, who等）等自然断点拆分
- 每个片段应是语法上相对完整的短语或子句
- 片段不宜过长，控制在 2-12 个单词左右
- 每个片段必须提供准确的中文翻译

## 用户仅提供单词时
只需返回 meaning 和 phonetic 字段，phrase、phraseMeaning 和 segments 可省略。

JSON格式：
{"meaning":"常见中文释义","phonetic":"IPA音标，如 /ˈɪŋɡlɪʃ/"}

仅输出JSON，不要任何解释或额外文字。`;

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
          { role: "user", content: sentence ? sentence : `查词: ${word}` },
        ],
        response_format: { type: "json_object" },
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
      return { word, meaning: { meaning: "未找到释义", phonetic: "", phrase: "", phraseMeaning: "" } };
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

    // Parse segments: array of {text, translation} objects
    let segments: SentenceSegment[] = [];
    if (Array.isArray(obj.segments)) {
      segments = obj.segments
        .filter(
          (s): s is Record<string, unknown> =>
            typeof s === "object" && s !== null && !Array.isArray(s)
        )
        .map((s) => ({
          text: typeof s.text === "string" ? s.text : "",
          translation: typeof s.translation === "string" ? s.translation : "",
        }))
        .filter((s) => s.text.length > 0);
    }

    return {
      word,
      meaning: {
        meaning: typeof obj.meaning === "string" ? obj.meaning : "未找到释义",
        phonetic: typeof obj.phonetic === "string" ? obj.phonetic : "",
        phrase: typeof obj.phrase === "string" ? obj.phrase : "",
        phraseMeaning: typeof obj.phraseMeaning === "string" ? obj.phraseMeaning : "",
        segments,
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
