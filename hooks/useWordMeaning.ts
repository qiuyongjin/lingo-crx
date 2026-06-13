// hooks/useWordMeaning.ts

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "../utils/storage";
import { fetchDefinition } from "../utils/deepseek";

export type MeaningState =
  | { status: "idle" }
  | { status: "loading"; word: string; sentence?: string | null }
  | { status: "result"; word: string; meaning: string; sentence?: string | null }
  | { status: "no-api-key" }
  | { status: "error"; word: string; error: string };

export function useWordMeaning() {
  const [state, setState] = useState<MeaningState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function lookup(word: string, sentence?: string | null) {
    // Abort any in-flight request
    abortRef.current?.abort();

    const apiKey = await getApiKey();
    if (!apiKey) {
      setState({ status: "no-api-key" });
      return;
    }

    setState({ status: "loading", word, sentence });

    const controller = new AbortController();
    abortRef.current = controller;

    // Fetch definition from DeepSeek
    const contextResult = await fetchDefinition(word, apiKey, sentence ?? undefined, controller.signal);

    if (controller.signal.aborted) return;

    if ("meaning" in contextResult) {
      setState({
        status: "result",
        word: contextResult.word,
        meaning: contextResult.meaning,
        sentence,
      });
    } else {
      setState({ status: "error", word: contextResult.word, error: contextResult.error });
    }
  }

  function reset() {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { state, lookup, reset } as const;
}
