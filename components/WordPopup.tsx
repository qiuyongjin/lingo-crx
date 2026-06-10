// components/WordPopup.tsx

import { MeaningState } from "../hooks/useWordMeaning";
import { LoadingSpinner } from "./LoadingSpinner";

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
      {state.status === "loading" && (
        <div className="lingo-loading">
          <LoadingSpinner />
          <span>{state.word}</span>
          <span>查询中...</span>
        </div>
      )}

      {state.status === "result" && (
        <>
          <div className="lingo-word">{state.word}</div>
          <div className="lingo-meaning">{state.meaning}</div>
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
