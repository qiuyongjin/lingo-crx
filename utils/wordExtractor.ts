// utils/wordExtractor.ts

export interface WordInfo {
  word: string;
  rect: DOMRect;
}

/**
 * Extract the word at the given viewport coordinates.
 * Returns null if no word is found at that position.
 */
export function extractWordFromPoint(x: number, y: number): WordInfo | null {
  const range = getCaretRangeFromPoint(x, y);
  if (!range) return null;

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent || "";
  const offset = range.startOffset;
  if (offset < 0 || offset > text.length) return null;

  // Find word boundaries (supports Latin and CJK characters)
  const wordRegex = /[\w一-鿿㐀-䶿]/u;
  let start = offset;
  let end = offset;

  // Expand left
  while (start > 0 && wordRegex.test(text[start - 1])) {
    start--;
  }

  // Expand right
  while (end < text.length && wordRegex.test(text[end])) {
    end++;
  }

  const word = text.slice(start, end).trim();
  if (!word || word.length === 0 || word.length > 50) return null;

  // Get bounding rect for the word
  const wordRange = document.createRange();
  wordRange.setStart(node, start);
  wordRange.setEnd(node, end);
  const rect = wordRange.getBoundingClientRect();

  return { word, rect };
}

function getCaretRangeFromPoint(x: number, y: number): Range | null {
  try {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(x, y);
    }
    // Fallback for older browsers
    const caretPos = (document as any).caretPositionFromPoint?.(x, y);
    if (caretPos) {
      const range = document.createRange();
      range.setStart(caretPos.offsetNode, caretPos.offset);
      range.setEnd(caretPos.offsetNode, caretPos.offset);
      return range;
    }
  } catch {
    // caretRangeFromPoint can throw on some shadow DOM boundaries
  }
  return null;
}
