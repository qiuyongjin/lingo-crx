// components/SpeakButton.tsx

import { useState, useCallback } from "react";

interface SpeakButtonProps {
  word: string;
  lang?: string;
}

export function SpeakButton({ word, lang = "en-US" }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  // Browser doesn't support speech synthesis — render nothing
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const handleClick = useCallback(() => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
    utterance.rate = 0.9;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [word, lang, speaking]);

  return (
    <button
      className={`lingo-speak-btn${speaking ? " lingo-speak-btn--active" : ""}`}
      onClick={handleClick}
      title={speaking ? "Stop" : "Listen"}
      aria-label={speaking ? "Stop pronunciation" : "Play pronunciation"}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {speaking ? (
          <>
            <rect x="6" y="6" width="4" height="12" rx="1" />
            <rect x="14" y="6" width="4" height="12" rx="1" />
          </>
        ) : (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
    </button>
  );
}
