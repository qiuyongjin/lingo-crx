// utils/popupPosition.ts
// Shared types for popup positioning. The popup is rendered inside a Shadow DOM
// attached to a position:absolute container at document (0,0), so CSS left/top
// must be in document coordinates.

export interface PopupAnchor {
  /** Document X of the word center (used to center the popup and point the arrow). */
  x: number;
  /** Document Y of the word bottom + 6px gap (popup top edge target). */
  y: number;
  /** Document Y of the word's top edge (used when flipping the popup above). */
  wordTop: number;
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
