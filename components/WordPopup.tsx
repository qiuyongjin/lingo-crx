// components/WordPopup.tsx

import { MeaningState } from "../hooks/useWordMeaning";
import { LoadingSpinner } from "./LoadingSpinner";
import { SpeakButton } from "./SpeakButton";

interface WordPopupProps {
  state: MeaningState;
  top: number;
  left: number;
  onToggleSettings: () => void;
}

export function WordPopup({
  state,
  top,
  left,
  onToggleSettings,
}: WordPopupProps) {
  return (
    <div
      className="lingo-popup"
      style={{ top: `${top}px`, left: `${left}px` }}
      data-testid="lingo-popup"
    >
      <button
        className="lingo-settings-btn"
        onClick={onToggleSettings}
        title="设置"
        aria-label="打开设置"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {"word" in state && (
        <div className="lingo-word">
          <span>{state.word}</span>
          <SpeakButton word={state.word} />
        </div>
      )}

      {state.status === "loading" && (
        <div className="lingo-loading">
          <LoadingSpinner />
          <span>查询中...</span>
        </div>
      )}

      {state.status === "result" && (
        <>
          <div className="lingo-meaning">{state.meaning.meaning}</div>
          {state.meaning.phrase && (
            <div className="lingo-context">
              <div className="lingo-context-phrase">
              <span>{state.meaning.phrase}</span>
              <SpeakButton word={state.meaning.phrase} />
            </div>
              <div className="lingo-context-translation">{state.meaning.phraseMeaning}</div>
            </div>
          )}
          {/* {state.sentence && (
            <div className="lingo-sentence">{state.sentence}</div>
          )} */}
        </>
      )}

      {state.status === "error" && (
        <div className="lingo-error">{state.error}</div>
      )}

      {state.status === "no-api-key" && (
        <div>
          <div className="lingo-no-key">
            请先配置 DeepSeek API Key
          </div>
          <a
            className="lingo-settings-link"
            onClick={(e) => {
              e.preventDefault();
              onToggleSettings();
            }}
          >
            前往设置 →
          </a>
        </div>
      )}

    </div>
  );
}
