// components/WordPopup.tsx

import { MeaningState } from "../hooks/useWordMeaning";
import { LoadingSpinner } from "./LoadingSpinner";
import { SpeakButton } from "./SpeakButton";

interface WordPopupProps {
  state: MeaningState;
  top: number;
  left: number;
  onOpenSettings: () => void;
}

export function WordPopup({
  state,
  top,
  left,
  onOpenSettings,
}: WordPopupProps) {
  return (
    <div
      className="lingo-popup"
      style={{ top: `${top}px`, left: `${left}px` }}
      data-testid="lingo-popup"
    >
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
          {state.sentence && (
            <div className="lingo-sentence">{state.sentence}</div>
          )}
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
              onOpenSettings();
            }}
          >
            前往设置 →
          </a>
        </div>
      )}

    </div>
  );
}
