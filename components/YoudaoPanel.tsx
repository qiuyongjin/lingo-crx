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
        <div className="lingo-placeholder-icon">✨</div>
        <div className="lingo-placeholder-title">更多功能</div>
        <div className="lingo-placeholder-text">即将推出</div>
      </div>
    );
  }

  const showSeparator =
    (data.phrases.length > 0 || data.relWords.length > 0) &&
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

      {data.relWords.length > 0 && (
        <div className="lingo-dict-section">
          <div className="lingo-dict-section-title">相关词汇</div>
          {data.relWords.map((group, i) => (
            <div key={i} className="lingo-dict-relgroup">
              <span className="lingo-dict-relgroup-pos">{group.pos}</span>
              <span className="lingo-dict-relgroup-words">
                {group.words.map((w, j) => (
                  <span key={j} className="lingo-dict-relword">
                    {w.word}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
