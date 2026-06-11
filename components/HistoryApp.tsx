// components/HistoryApp.tsx

import { useState, useCallback, useEffect } from "react";
import { useHistory } from "../hooks/useHistory";
import { FloatingButton } from "./FloatingButton";
import { HistoryPanel } from "./HistoryPanel";

interface HistoryAppProps {
  onAddItemRef: (fn: ((word: string, context: string) => void) | null) => void;
}

export function HistoryApp({ onAddItemRef }: HistoryAppProps) {
  const { items, loading, addItem } = useHistory();
  const [isOpen, setIsOpen] = useState(false);

  // Expose addItem to the content script via ref callback
  useEffect(() => {
    onAddItemRef(addItem);
    return () => onAddItemRef(null);
  }, [addItem, onAddItemRef]);

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
      <FloatingButton onClick={toggleOpen} />
      {isOpen && <HistoryPanel items={items} loading={loading} onClose={close} />}
    </div>
  );
}
