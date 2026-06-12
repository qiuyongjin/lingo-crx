// components/WordPopup.tsx

import { MeaningState } from "../hooks/useWordMeaning";
import { useYoudaoDictionary } from "../hooks/useYoudaoDictionary";
import { LoadingSpinner } from "./LoadingSpinner";
import { SpeakButton } from "./SpeakButton";
import { YoudaoPanel } from "./YoudaoPanel";
import { SentenceSegment } from "../utils/deepseek";

interface WordPopupProps {
  state: MeaningState;
  top: number;
  left: number;
  arrowLeft: number;
  onToggleSettings: () => void;
}

function SegmentList({ segments }: { segments: SentenceSegment[] }) {
  return (
    <div className="lingo-segments">
      {segments.map((seg, i) => (
        <div key={i} className="lingo-segment">
          <div className="lingo-segment-text">{seg.text}</div>
          <div className="lingo-segment-translation">{seg.translation}</div>
        </div>
      ))}
    </div>
  );
}

export function WordPopup({
  state,
  top,
  left,
  arrowLeft,
  onToggleSettings,
}: WordPopupProps) {
  // Extract word from the discriminated union — available in loading/result/error states
  const word = "word" in state ? state.word : null;
  const { data: youdaoData, loading: youdaoLoading } = useYoudaoDictionary(word);

  return (
    <div
      className="lingo-popup lingo-popup--split"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        "--arrow-left": `${arrowLeft}px`,
        "--arrow-transform": "none",
      } as React.CSSProperties}
      data-testid="lingo-popup"
    >
      <div className="lingo-toolbar">
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
      </div>

      <div className="lingo-panels">
        <div className="lingo-panel-left">
          {"word" in state && (
            <div className="lingo-word">
              <div className="lingo-word-row">
                <span className="lingo-word-text">{state.word}</span>
                <SpeakButton word={state.word} />
              </div>
              {state.status === "result" && state.meaning.phonetic && (
                <span className="lingo-phonetic">{state.meaning.phonetic}</span>
              )}
            </div>
          )}

          {state.status === "loading" && (
            <>
              <div className="lingo-loading">
                <LoadingSpinner />
                <span>Thinking...</span>
              </div>
              {state.segments && state.segments.length > 0 && (
                <SegmentList segments={state.segments} />
              )}
              {state.segmentsError && (
                <div className="lingo-segments-error">{state.segmentsError}</div>
              )}
            </>
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
              {state.segmentsLoading && (
                <div className="lingo-segments-loading">
                  <LoadingSpinner />
                  <span>拆分句子...</span>
                </div>
              )}
              {state.segmentsError && (
                <div className="lingo-segments-error">{state.segmentsError}</div>
              )}
              {!state.segmentsLoading && state.meaning.segments && state.meaning.segments.length > 0 && (
                <SegmentList segments={state.meaning.segments} />
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
                  onToggleSettings();
                }}
              >
                前往设置 →
              </a>
            </div>
          )}
        </div>

        <div className="lingo-panel-right">
          <YoudaoPanel data={youdaoData} loading={youdaoLoading} word={word} />
        </div>
      </div>

    </div>
  );
}
