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
      {"word" in state && (
        <div className="lingo-word">{state.word}</div>
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
              <div className="lingo-context-phrase">{state.meaning.phrase}</div>
              <div className="lingo-context-translation">{state.meaning.phraseMeaning}</div>
            </div>
          )}
          {state.generalMeanings && state.generalMeanings.length > 0 && (
            <div className="lingo-general-section">
              {state.generalMeanings.map((gm, i) => (
                <div key={i} className="lingo-general-item">
                  <div className="lingo-general-pos">
                    <span className="lingo-general-pos-label">{gm.pos}</span>
                    <span className="lingo-general-meaning">{gm.meaning}</span>
                    <span className="lingo-general-keyword">({gm.keyword})</span>
                  </div>
                  <div className="lingo-general-example">{gm.example}</div>
                </div>
              ))}
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
