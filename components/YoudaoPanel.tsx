// components/YoudaoPanel.tsx

import { YoudaoData } from "../utils/youdao";
import { LoadingSpinner } from "./LoadingSpinner";

interface YoudaoPanelProps {
  data: YoudaoData | null;
  loading: boolean;
  word: string | null;
}

/**
 * Right-side panel that shows Youdao dictionary data.
 * Falls back to the placeholder when no word is active.
 */
export function YoudaoPanel({ data, loading, word }: YoudaoPanelProps) {
  if (!word) {
    return (
      <div className="lingo-placeholder">
        <div className="lingo-placeholder-icon">✨</div>
        <div className="lingo-placeholder-title">更多功能</div>
        <div className="lingo-placeholder-text">即将推出</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="lingo-dict-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="lingo-placeholder">
        <div className="lingo-placeholder-icon">📭</div>
        <div className="lingo-placeholder-title">未找到释义</div>
        <div className="lingo-placeholder-text">换个词试试</div>
      </div>
    );
  }

  const showSeparator =
    (data.phrases.length > 0 || data.sentences.length > 0) &&
    (data.translations.length > 0 || data.examTypes.length > 0);

  return (
    <div className="lingo-dict">
      {data.translations.length > 0 && (
        <div className="lingo-dict-translations">
          {data.translations.map((t, i) => (
            <div key={i} className="lingo-dict-row">
              <span className="lingo-dict-pos">{t.pos}</span>
              <span className="lingo-dict-def">
                {t.sense}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.examTypes.length > 0 && (
        <div className="lingo-dict-exams">
          {data.examTypes.map((exam) => (
            <span key={exam} className="lingo-dict-exam-tag">{exam}</span>
          ))}
        </div>
      )}

      {data.wordForms.length > 0 && (
        <div className="lingo-dict-forms">
          {data.wordForms.map((wf, i) => (
            <span key={i} className="lingo-dict-form">
              <span className="lingo-dict-form-name">{wf.name}</span>
              <span className="lingo-dict-form-value">{wf.value}</span>
            </span>
          ))}
        </div>
      )}

      {showSeparator && <div className="lingo-dict-separator" />}

      {data.phrases.length > 0 && (
        <div className="lingo-dict-section">
          <div className="lingo-dict-section-title">常用搭配</div>
          {data.phrases.slice(0, 5).map((p, i) => (
            <div key={i} className="lingo-dict-phrase">
              <div className="lingo-dict-phrase-text">{p.text}</div>
              <div className="lingo-dict-phrase-tran">{p.translation}</div>
            </div>
          ))}
        </div>
      )}

      {data.sentences.length > 0 && (
        <div className="lingo-dict-section">
          <div className="lingo-dict-section-title">双语例句</div>
          {data.sentences.map((s, i) => (
            <div key={i} className="lingo-dict-sentence">
              <div className="lingo-dict-sentence-en">{s.english}</div>
              <div className="lingo-dict-sentence-tran">{s.translation}</div>
            </div>
          ))}
        </div>
      )}

      {/* Web translations — shown for non-dictionary words (names, rare terms) */}
      {data.webTranslations && data.webTranslations.length > 0 && (
        <div className="lingo-dict-section">
          <div className="lingo-dict-section-title">网络释义</div>
          {data.webTranslations.map((wt, i) => (
            <div key={i} className="lingo-dict-webtrans">
              <div className="lingo-dict-webtrans-key">{wt.key}</div>
              <div className="lingo-dict-webtrans-values">
                {wt.values.join("；")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Typo / "did you mean?" suggestions */}
      {data.typoSuggestions && data.typoSuggestions.length > 0 && (
        <div className="lingo-dict-section">
          <div className="lingo-dict-section-title">您要找的是不是？</div>
          {data.typoSuggestions.map((t, i) => (
            <div key={i} className="lingo-dict-typo">
              <span className="lingo-dict-typo-word">{t.word}</span>
              <span className="lingo-dict-typo-trans">{t.trans}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
