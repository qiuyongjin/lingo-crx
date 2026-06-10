// utils/deepseek.ts

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT =
  "你是一个词典助手。用户提供句子和{}标记的单词时，根据语境翻译该单词的准确中文释义。用户仅提供单词时，翻译该单词的常见中文释义。格式：'释义'，不要任何额外解释。";

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
