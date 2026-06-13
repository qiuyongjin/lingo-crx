// components/WordPopup.tsx

import { useRef, useLayoutEffect } from "react";
import { MeaningState } from "../hooks/useWordMeaning";
import { useYoudaoDictionary } from "../hooks/useYoudaoDictionary";
import { LoadingSpinner } from "./LoadingSpinner";
import { SpeakButton } from "./SpeakButton";
import { YoudaoPanel } from "./YoudaoPanel";
import type { PopupAnchor } from "../utils/popupPosition";
import { clamp } from "../utils/popupPosition";

interface WordPopupProps {
  state: MeaningState;
  anchor: PopupAnchor;
  enableAI: boolean | null;
  word: string;
  onToggleSettings: () => void;
}

export function WordPopup({
  state,
  anchor,
  enableAI,
  word,
  onToggleSettings,
}: WordPopupProps) {
  const { data: youdaoData, loading: youdaoLoading, fromCache } = useYoudaoDictionary(word);

  // Measure actual rendered size and compute the final position before paint.
  // The popup width depends on CSS panel widths + padding — by measuring the
  // live DOM we stay correct regardless of CSS changes.  useLayoutEffect runs
  // synchronously after DOM commit but before the browser paints, so there
  // is no visible flash.
  const popupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const margin = 8;

    // Convert anchor from document to viewport coords
    const anchorVpX = anchor.x - window.scrollX;
    const anchorVpY = anchor.y - window.scrollY;

    // Target: centered below the word
    let left = anchorVpX - rect.width / 2;
    let top = anchorVpY;

    // Flip above the word if the popup would overflow the viewport bottom.
    if (top + rect.height > window.innerHeight - margin) {
      const wordTopVp = anchor.wordTop - window.scrollX;
      top = wordTopVp - 6 - rect.height; // 6px gap below arrow
    }

    // Clamp horizontal within viewport (8px margin)
    left = clamp(left, margin, window.innerWidth - rect.width - margin);

    // Clamp vertical within viewport
    top = clamp(top, margin, window.innerHeight - rect.height - margin);

    // Apply position in document coords (container is at doc 0,0)
    el.style.left = `${left + window.scrollX}px`;
    el.style.top = `${top + window.scrollY}px`;

    // Arrow: point at the word center, relative to the popup's left edge.
    // Clamp within popup bounds so the arrow doesn't point outside the popup.
    const arrowLeft = anchorVpX - left;
    el.style.setProperty(
      "--arrow-left",
      `${clamp(arrowLeft, 12, rect.width - 12)}px`,
    );
    el.style.setProperty("--arrow-transform", "none");
  }, [anchor]);

  return (
    <div
      ref={popupRef}
      className="lingo-popup"
      data-testid="lingo-popup"
    >
      <div className="lingo-popup-scroll">
        <div className="lingo-panels">
          <div className="lingo-panel-left">
            {"word" in state && (
              <div className="lingo-word">
                <div className="lingo-word-row">
                  <span className={`lingo-word-text${fromCache ? " lingo-word-text-cached" : ""}`}>{state.word}</span>
                  <SpeakButton word={state.word} />
                </div>
                {youdaoData && (youdaoData.ukphone || youdaoData.usphone) && (
                  <span className="lingo-phonetic">
                    {youdaoData.ukphone && <span className="lingo-phonetic-uk">英 {youdaoData.ukphone}</span>}
                    {youdaoData.usphone && <span className="lingo-phonetic-us">美 {youdaoData.usphone}</span>}
                  </span>
                )}
              </div>
            )}
            <YoudaoPanel data={youdaoData} loading={youdaoLoading} word={word} />
          </div>

          {enableAI !== false && (
            <div className="lingo-panel-right">
              {state.status === "loading" && (
                <div className="lingo-loading">
                  <LoadingSpinner />
                  <span>Thinking...</span>
                </div>
              )}

              {state.status === "streaming" && (
                <div className="lingo-meaning">
                  {state.meaning}
                  <span className="lingo-cursor-blink">|</span>
                </div>
              )}

              {state.status === "result" && (
                <div className="lingo-meaning">{state.meaning}</div>
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
          )}
        </div>

        <div className="lingo-footer">
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
      </div>
    </div>
  );
}
