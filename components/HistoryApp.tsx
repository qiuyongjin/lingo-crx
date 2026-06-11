// components/HistoryApp.tsx

import { useState, useCallback, useEffect } from "react";
import { useHistory } from "../hooks/useHistory";
import { FloatingButton } from "./FloatingButton";
import { HistoryPanel } from "./HistoryPanel";

export function HistoryApp() {
  const { items, loading, reload } = useHistory();
  const [isOpen, setIsOpen] = useState(false);

  // Reload history from storage when panel opens (items may have been
  // added externally via addHistoryItem in the content script)
  useEffect(() => {
    if (isOpen) reload();
  }, [isOpen, reload]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  return (
    <div className="lingo-history-root">
      {!isOpen && <FloatingButton onClick={toggleOpen} />}
      {isOpen && <HistoryPanel items={items} loading={loading} onClose={close} />}
    </div>
  );
}
