// hooks/useWordMeaning.ts

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "../utils/storage";
import { fetchDefinition, fetchSegments, ContextualMeaning } from "../utils/deepseek";

export type MeaningState =
  | { status: "idle" }
  | { status: "loading"; word: string; sentence?: string | null }
  | { status: "result"; word: string; meaning: ContextualMeaning; sentence?: string | null; segmentsLoading: boolean; segmentsError?: string }
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

    const hasSentence = !!sentence;

    // Fire both requests concurrently — definition and segments are independent
    const defPromise = fetchDefinition(word, apiKey, sentence ?? undefined, controller.signal);
    const segPromise = hasSentence
      ? fetchSegments(sentence, apiKey, controller.signal)
      : null;

    // Wait for definition first to transition from loading → result
    const contextResult = await defPromise;

    if (controller.signal.aborted) return;

    if ("meaning" in contextResult) {
      setState({
        status: "result",
        word: contextResult.word,
        meaning: contextResult.meaning,
        sentence,
        segmentsLoading: hasSentence,
      });

      // Await segments (already in-flight; may resolve immediately if it finished first)
      if (segPromise) {
        const segmentsResult = await segPromise;

        if (controller.signal.aborted) return;

        if ("segments" in segmentsResult) {
          setState((prev) => {
            if (prev.status === "result") {
              return {
                ...prev,
                meaning: { ...prev.meaning, segments: segmentsResult.segments },
                segmentsLoading: false,
              };
            }
            return prev;
          });
        } else {
          setState((prev) => {
            if (prev.status === "result") {
              return { ...prev, segmentsLoading: false, segmentsError: segmentsResult.error };
            }
            return prev;
          });
        }
      }
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
