// utils/deepseek.ts

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT = `你是词典助手。使命：让用户看懂单词在语境中的含义和用法。

用户提供句子时（{}标记的是目标词），从原文提取包含该词的短语/搭配，给出单词释义和短语翻译。让用户既理解单词意思，又看懂整个句子。

格式自由，怎么清楚怎么来。善用" / "、"……"等符号。

用户仅提供单词时，给出常见中文释义。

仅输出翻译本身，不要任何解释。`;

const GENERAL_PROMPT = `你是一个词典助手。请针对单词输出其所有常见词性及对应释义，以JSON格式返回。
格式：{"meanings":[{"pos":"n.","meaning":"中文释义","keyword":"english keyword","example":"example sentence"},...]}

要求：
1. 忽略没有实际用法的词性
2. 每个词性提供一个英文例句，需能体现该释义的用法
3. 仅输出JSON，不要任何额外解释`;

export interface DefinitionResult {
  word: string;
  meaning: string;
}

export interface DefinitionError {
  word: string;
  error: string;
  code: "NO_API_KEY" | "API_ERROR" | "NETWORK_ERROR";
}

export interface GeneralMeaning {
  pos: string;
  meaning: string;
  keyword: string;
  example: string;
}

export type FetchDefinitionResult = DefinitionResult | DefinitionError;

export async function fetchDefinition(
  word: string,
  apiKey: string,
  sentence?: string | null
): Promise<FetchDefinitionResult> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: sentence ? `句子: ${sentence}` : `查词: ${word}` },
        ],
        max_tokens: 80,
        temperature: 0.3,
      }),
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

    const meaning =
      data.choices?.[0]?.message?.content?.trim() || "未找到释义";

    return { word, meaning };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message === "Failed to fetch"
        ? "网络连接失败，请检查网络"
        : `请求出错: ${err instanceof Error ? err.message : String(err)}`;
    return { word, error: message, code: "NETWORK_ERROR" };
  }
}

export async function fetchGeneralMeanings(
  word: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<GeneralMeaning[]> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: GENERAL_PROMPT },
          { role: "user", content: `查词: ${word}` },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return [];

    // DeepSeek may wrap JSON in markdown code fences — strip them
    let json = raw;
    if (json.startsWith("```")) {
      json = json.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
    }

    const parsed = JSON.parse(json);
    if (Array.isArray(parsed.meanings)) {
      return parsed.meanings as GeneralMeaning[];
    }
    return [];
  } catch {
    return [];
  }
}
