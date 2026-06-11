// components/FloatingButton.tsx
//
// A draggable floating action button. During drag the button follows the mouse
// freely (X + Y).  On release the X coordinate snaps to the right edge and the
// Y coordinate is persisted to chrome.storage.local.

import { useState, useRef, useEffect, useCallback } from "react";

interface FloatingButtonProps {
  onClick: () => void;
}

const STORAGE_KEY = "lingo-history-fab-top";
const BTN_SIZE = 36;

function getDefaultTop(): number {
  return Math.round(window.innerHeight / 2 - BTN_SIZE / 2);
}

export function FloatingButton({ onClick }: FloatingButtonProps) {
  const [top, setTop] = useState<number>(getDefaultTop);
  /** Pixel `left` during drag; `undefined` → CSS `right: 12px` snaps X home. */
  const [left, setLeft] = useState<number | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);

  // Refs keep values fresh in document-level event closures without
  // re-registering listeners on every pixel change.
  const topRef = useRef(top);
  const leftRef = useRef(left);

  const dragState = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const hasDragged = useRef(false);

  useEffect(() => {
    topRef.current = top;
  }, [top]);

  useEffect(() => {
    leftRef.current = left;
  }, [left]);

  // Restore persisted Y position on mount (X always starts snapped right).
  useEffect(() => {
    chrome.storage.local
      .get(STORAGE_KEY)
      .then((result) => {
        const saved = result[STORAGE_KEY];
        if (typeof saved === "number") {
          setTop(clamp(saved));
        }
      })
      .catch(() => {
        /* storage unavailable — use default position */
      });
  }, []);

  // ── Drag initialisation ────────────────────────────────────────

  const onPointerDown = useCallback((clientX: number, clientY: number) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    hasDragged.current = false;
    dragState.current = {
      startX: clientX,
      startY: clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    setIsDragging(true);
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // prevent text selection while dragging
      onPointerDown(e.clientX, e.clientY);
    },
    [onPointerDown],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    },
    [onPointerDown],
  );

  // ── Document-level move / end listeners (active only while dragging) ─

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (clientX: number, clientY: number) => {
      if (!dragState.current) return;

      const dx = clientX - dragState.current.startX;
      const dy = clientY - dragState.current.startY;

      const newLeft = Math.max(
        0,
        Math.min(
          window.innerWidth - BTN_SIZE,
          Math.round(dragState.current.startLeft + dx),
        ),
      );
      const newTop = clamp(dragState.current.startTop + dy);

      leftRef.current = newLeft;
      topRef.current = newTop;
      setLeft(newLeft);
      setTop(newTop);
      hasDragged.current = true;
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) =>
      onMove(e.touches[0].clientX, e.touches[0].clientY);

    const onEnd = () => {
      dragState.current = null;
      setIsDragging(false);
      setLeft(undefined); // snap X back to the right edge

      if (hasDragged.current) {
        chrome.storage.local
          .set({ [STORAGE_KEY]: topRef.current })
          .catch(() => {
            /* best-effort */
          });
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging]);

  // ── Click handler — ignore if the user was dragging ────────────

  const onClick_ = useCallback(
    (e: React.MouseEvent) => {
      if (hasDragged.current) return;
      onClick();
    },
    [onClick],
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <button
      ref={buttonRef}
      className="lingo-history-fab"
      style={{
        top,
        left, // undefined → not in inline style → CSS `right: 12px` takes over
        transition: isDragging ? "none" : undefined,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onClick={onClick_}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      title="查词历史"
      aria-label="打开查词历史"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </button>
  );
}

/** Clamp the pixel offset so the button never goes off-screen. */
function clamp(value: number): number {
  return Math.max(
    0,
    Math.min(window.innerHeight - BTN_SIZE, Math.round(value)),
  );
}
