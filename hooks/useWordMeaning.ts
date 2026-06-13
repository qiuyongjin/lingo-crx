// hooks/useWordMeaning.ts

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "../utils/storage";
import { fetchDefinitionStream, normalizeError } from "../utils/deepseek";

export type MeaningState =
  | { status: "idle" }
  | { status: "loading"; word: string; sentence?: string | null }
  | { status: "streaming"; word: string; meaning: string; sentence?: string | null }
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

    try {
      // Stream definition from DeepSeek — progressively update UI
      let accumulated = "";
      for await (const chunk of fetchDefinitionStream(
        word,
        apiKey,
        sentence ?? undefined,
        controller.signal,
      )) {
        accumulated += chunk;
        setState({
          status: "streaming",
          word,
          meaning: accumulated,
          sentence,
        });
      }

      if (controller.signal.aborted) return;

      setState({
        status: "result",
        word,
        meaning: accumulated,
        sentence,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const { error } = normalizeError(err);
      setState({ status: "error", word, error });
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
