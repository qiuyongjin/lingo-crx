// components/SettingsPanel.tsx

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { getRequireAltKey, setRequireAltKey, getAutoSpeak, setAutoSpeak } from "../utils/storage";
import type { PopupAnchor } from "../utils/popupPosition";
import { clamp } from "../utils/popupPosition";

interface SettingsPanelProps {
  anchor: PopupAnchor;
  onBack: () => void;
}

export function SettingsPanel({ anchor, onBack }: SettingsPanelProps) {
  const [requireAlt, setRequireAlt] = useState(true);
  const [autoSpeak, setAutoSpeakState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getRequireAltKey(), getAutoSpeak()]).then(([alt, speak]) => {
      setRequireAlt(alt);
      setAutoSpeakState(speak);
      setLoaded(true);
    });
  }, []);

  async function handleToggle(checked: boolean) {
    setRequireAlt(checked);
    await setRequireAltKey(checked);
  }

  // Measure actual rendered size and compute the final position before paint.
  // No hardcoded widths — adapts automatically to any CSS changes.
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const margin = 8;

    // Compute position in viewport coords, then convert to document coords.
    const anchorVpX = anchor.x - window.scrollX;
    const anchorVpY = anchor.y - window.scrollY;

    // Center horizontally below the word
    let left = anchorVpX - rect.width / 2;

    // Flip above the word if the popup would overflow the viewport bottom
    let top = anchorVpY;
    if (top + rect.height > window.innerHeight - margin) {
      const wordTopVp = anchor.wordTop - window.scrollX;
      top = wordTopVp - 6 - rect.height; // 6px gap above word
    }

    // Clamp to viewport with margin
    left = clamp(left, margin, window.innerWidth - rect.width - margin);
    top = clamp(top, margin, window.innerHeight - rect.height - margin);

    // Convert to document coords for the absolute-positioned container
    el.style.left = `${left + window.scrollX}px`;
    el.style.top = `${top + window.scrollY}px`;
  }, [anchor]);

  if (!loaded) {
    return (
      <div ref={panelRef} className="lingo-popup">
        <div className="lingo-settings">
          <div className="lingo-loading">
            <span>加载中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="lingo-popup">
      <div className="lingo-settings">
        <div className="lingo-settings-header">
        <button
          className="lingo-settings-back"
          onClick={onBack}
          title="返回"
          aria-label="返回"
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="lingo-settings-title">偏好设置</span>
      </div>

      <label className="lingo-settings-toggle">
        <input
          type="checkbox"
          checked={requireAlt}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span className="lingo-settings-toggle-label">
          需要按住 Option (Alt) 键点击单词
        </span>
      </label>
      <p className="lingo-settings-hint">
        关闭后，直接点击页面上的单词即可查词。
      </p>

      <label className="lingo-settings-toggle">
        <input
          type="checkbox"
          checked={autoSpeak}
          onChange={(e) => {
            const checked = e.target.checked;
            setAutoSpeakState(checked);
            setAutoSpeak(checked);
          }}
        />
        <span className="lingo-settings-toggle-label">
          查出单词后自动朗读发音
        </span>
      </label>
      <p className="lingo-settings-hint">
        开启后，查词时自动朗读单词。
      </p>
      </div>
    </div>
  );
}
