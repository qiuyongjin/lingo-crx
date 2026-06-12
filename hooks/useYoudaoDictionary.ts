// hooks/useYoudaoDictionary.ts

import { useState, useEffect, useRef } from "react";
import { fetchYoudaoDictionary, YoudaoData } from "../utils/youdao";

export function useYoudaoDictionary(word: string | null) {
  const [data, setData] = useState<YoudaoData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    setData(null);

    if (!word) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    fetchYoudaoDictionary(word, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [word]);

  return { data, loading };
}
