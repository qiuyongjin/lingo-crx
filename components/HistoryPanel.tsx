// components/HistoryPanel.tsx

import { type HistoryItem } from "../utils/historyStorage";

interface HistoryPanelProps {
  items: HistoryItem[];
  loading: boolean;
  onClose: () => void;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function HistoryPanel({ items, loading, onClose }: HistoryPanelProps) {
  return (
    <>
      {/* Backdrop overlay — click to dismiss */}
      <div className="lingo-history-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="lingo-history-panel">
        {/* Header */}
        <div className="lingo-history-header">
          <div>
            <span className="lingo-history-header-title">📖 查词历史</span>
            {!loading && items.length > 0 && (
              <span className="lingo-history-header-count">{items.length}条</span>
            )}
          </div>
          <button
            className="lingo-history-header-close"
            onClick={onClose}
            title="关闭"
            aria-label="关闭历史面板"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* List or Empty */}
        <div className="lingo-history-list">
          {loading && (
            <div className="lingo-history-empty">加载中...</div>
          )}
          {!loading && items.length === 0 && (
            <div className="lingo-history-empty">暂无查词记录</div>
          )}
          {!loading &&
            items.map((item, i) => (
              <div key={`${item.timestamp}-${i}`} className="lingo-history-item">
                <div className="lingo-history-item-word">{item.word}</div>
                <div className="lingo-history-item-context">{item.context}</div>
                <div className="lingo-history-item-time">
                  {formatTime(item.timestamp)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
