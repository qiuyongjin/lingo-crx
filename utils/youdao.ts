// utils/youdao.ts — Youdao dictionary API client (via background proxy)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YoudaoTranslation {
  pos: string;
  sense: string;
}

export interface YoudaoWordForm {
  name: string;
  value: string;
}

export interface YoudaoPhrase {
  text: string;
  translation: string;
}

export interface YoudaoRelWord {
  pos: string;
  words: { word: string; tran: string }[];
}

export interface YoudaoSentence {
  english: string;
  translation: string;
}

export interface YoudaoData {
  word: string;
  usphone?: string;
  ukphone?: string;
  translations: YoudaoTranslation[];
  wordForms: YoudaoWordForm[];
  examTypes: string[];
  phrases: YoudaoPhrase[];
  relWords: YoudaoRelWord[];
  sentences: YoudaoSentence[];
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseTranslations(trs: unknown[]): YoudaoTranslation[] {
  return trs.map((tr: any) => {
    const raw: string = tr?.tr?.[0]?.l?.i?.[0] ?? "";
    if (!raw) return { pos: "", sense: "" };

    const posMatch = raw.match(/^([a-zA-Z]+\.)\s+(.*)/);
    const pos = posMatch ? posMatch[1] : "";
    const sense = posMatch ? posMatch[2] : raw;

    return { pos, sense };
  });
}

function parseWordForms(wfs: unknown[]): YoudaoWordForm[] {
  return wfs
    .map((wf: any) => ({
      name: wf?.wf?.name ?? "",
      value: wf?.wf?.value ?? "",
    }))
    .filter((f) => f.name && f.value);
}

/** Parse the `phrs` array — common phrases / collocations. */
function parsePhrases(phrs: unknown[]): YoudaoPhrase[] {
  return phrs
    .map((p: any) => {
      const phr = p?.phr;
      const text = phr?.headword?.l?.i ?? "";
      const translation = phr?.trs?.[0]?.tr?.l?.i ?? "";
      return { text, translation };
    })
    .filter((p) => p.text && p.translation);
}

/** Parse the `rel_word.rels` array — related words grouped by POS. */
function parseRelWords(rels: unknown[]): YoudaoRelWord[] {
  return rels
    .map((r: any) => {
      const rel = r?.rel;
      if (!rel?.pos) return null;
      const words = (rel.words ?? [])
        .map((w: any) => ({
          word: w?.word ?? "",
          tran: w?.tran ?? "",
        }))
        .filter((w: { word: string }) => w.word);
      return words.length > 0 ? { pos: rel.pos as string, words } : null;
    })
    .filter((r): r is YoudaoRelWord => r !== null);
}

/** Parse the `blng_sents_part.sentence-pair` array — bilingual example sentences. */
function parseSentences(pairs: unknown[]): YoudaoSentence[] {
  return pairs
    .map((p: any) => {
      const english = p?.sentence ?? "";
      const translation = p?.["sentence-translation"] ?? "";
      return { english, translation };
    })
    .filter((s) => s.english && s.translation);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the Youdao dictionary entry for `word` via the background service
 * worker to avoid Origin/Referer 403 blocks from Youdao's server.
 */
export async function fetchYoudaoDictionary(
  word: string,
  signal?: AbortSignal,
): Promise<YoudaoData | null> {
  const fetchPromise = chrome.runtime.sendMessage({
    type: "fetchYoudao",
    word,
  }) as Promise<{ data: any }>;

  let abortReject: (() => void) | null = null;
  if (signal) {
    const abortPromise = new Promise<never>((_, reject) => {
      abortReject = () => reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", abortReject, { once: true });
    });

    try {
      const result = await Promise.race([fetchPromise, abortPromise]);
      return parseResult(word, result);
    } catch {
      return null;
    } finally {
      if (abortReject) signal.removeEventListener("abort", abortReject);
    }
  }

  try {
    const result = await fetchPromise;
    return parseResult(word, result);
  } catch {
    return null;
  }
}

function parseResult(
  word: string,
  result: { data: any } | null,
): YoudaoData | null {
  if (!result?.data) return null;
  const d = result.data;
  const ec = d?.ec;
  if (!ec?.word?.[0]) return null;

  const wordData = ec.word[0];

  return {
    word,
    usphone: wordData.usphone || undefined,
    ukphone: wordData.ukphone || undefined,
    translations: parseTranslations(wordData.trs ?? []),
    wordForms: parseWordForms(wordData.wfs ?? []),
    examTypes: Array.isArray(ec.exam_type) ? ec.exam_type : [],
    phrases: parsePhrases(d?.phrs?.phrs ?? []),
    relWords: parseRelWords(d?.rel_word?.rels ?? []),
    sentences: parseSentences(d?.blng_sents_part?.["sentence-pair"] ?? []),
  };
}
