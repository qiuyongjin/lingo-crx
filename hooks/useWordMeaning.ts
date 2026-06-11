// hooks/useWordMeaning.ts

import { useState, useEffect, useRef } from "react";
import { getApiKey } from "../utils/storage";
import { fetchDefinition, fetchSegments, ContextualMeaning, SentenceSegment } from "../utils/deepseek";

export type MeaningState =
  | { status: "idle" }
  | { status: "loading"; word: string; sentence?: string | null; segments?: SentenceSegment[]; segmentsError?: string }
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

    // Handle segments independently — show them as soon as they arrive,
    // even while the definition is still loading
    if (segPromise) {
      segPromise.then((segmentsResult) => {
        if (controller.signal.aborted) return;
        if ("segments" in segmentsResult) {
          setState((prev) => {
            if (prev.status === "loading") {
              return { ...prev, segments: segmentsResult.segments };
            }
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
            if (prev.status === "loading") {
              return { ...prev, segmentsError: segmentsResult.error };
            }
            if (prev.status === "result") {
              return { ...prev, segmentsLoading: false, segmentsError: segmentsResult.error };
            }
            return prev;
          });
        }
      });
    }

    // Wait for definition to transition from loading → result
    const contextResult = await defPromise;

    if (controller.signal.aborted) return;

    if ("meaning" in contextResult) {
      setState((prev) => {
        // Carry over segments if they arrived during loading
        const earlySegments = prev.status === "loading" ? prev.segments : undefined;
        const earlyError = prev.status === "loading" ? prev.segmentsError : undefined;
        const segmentsReady = !!earlySegments || !!earlyError;

        return {
          status: "result",
          word: contextResult.word,
          meaning: { ...contextResult.meaning, segments: earlySegments ?? contextResult.meaning.segments },
          sentence,
          segmentsLoading: hasSentence && !segmentsReady,
          segmentsError: earlyError,
        };
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
