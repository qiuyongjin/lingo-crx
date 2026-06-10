// hooks/useWordMeaning.ts

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "../utils/storage";
import { fetchDefinition, FetchDefinitionResult } from "../utils/deepseek";

export type MeaningState =
  | { status: "idle" }
  | { status: "loading"; word: string }
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

    setState({ status: "loading", word });

    const controller = new AbortController();
    abortRef.current = controller;

    const result: FetchDefinitionResult = await fetchDefinition(word, apiKey, sentence ?? undefined);

    // Don't update state if this request was aborted
    if (controller.signal.aborted) return;

    if ("meaning" in result) {
      setState({ status: "result", word: result.word, meaning: result.meaning, sentence });
    } else {
      setState({ status: "error", word: result.word, error: result.error });
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
