// utils/wordExtractor.ts

export interface WordInfo {
  word: string;
  rect: DOMRect;
  sentence: string | null;
}

const SENTENCE_TERMINATOR = /[.。!！?？]/;
const BLOCK_TAGS = new Set([
  "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6",
  "LI", "TD", "TH", "SECTION", "ARTICLE", "BLOCKQUOTE",
  "PRE", "BODY", "MAIN", "ASIDE", "NAV", "HEADER", "FOOTER",
]);

/**
 * Extract the word at the given viewport coordinates.
 * Also extracts the surrounding sentence for context-aware translation.
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

  // Extract surrounding sentence
  const sentence = extractSentence(node, start, end, word);

  return { word, rect, sentence };
}

/**
 * Find the nearest block-level ancestor of a node.
 */
function findBlockAncestor(node: Node): Element | null {
  let el: Node | null = node;
  while (el) {
    if (
      el.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((el as Element).tagName)
    ) {
      return el as Element;
    }
    el = el.parentNode;
  }
  return null;
}

/**
 * Calculate the character offset of a text node + offset within a block's full text.
 */
function textOffsetInBlock(
  block: Element,
  targetNode: Node,
  targetOffset: number
): number {
  let pos = 0;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node === targetNode) {
      return pos + targetOffset;
    }
    pos += (node.textContent || "").length;
  }
  return -1;
}

/**
 * Extract the sentence containing the word from the containing block element.
 * Returns null if no sentence terminators are found (e.g., button text, list items).
 */
function extractSentence(
  textNode: Node,
  wordStart: number,
  wordEnd: number,
  word: string
): string | null {
  const block = findBlockAncestor(textNode);
  if (!block) return null;

  const fullText = block.textContent || "";
  if (!fullText) return null;

  // Find the word's position in the block's full text
  const wordOffset = textOffsetInBlock(block, textNode, wordStart);
  if (wordOffset < 0 || wordOffset >= fullText.length) return null;

  // Search left for sentence terminator
  let sentStart = 0;
  for (let i = wordOffset - 1; i >= 0; i--) {
    if (SENTENCE_TERMINATOR.test(fullText[i])) {
      sentStart = i + 1;
      break;
    }
  }

  // Search right for sentence terminator
  let sentEnd = fullText.length;
  for (let i = wordOffset + word.length; i < fullText.length; i++) {
    if (SENTENCE_TERMINATOR.test(fullText[i])) {
      sentEnd = i + 1; // include the terminator
      break;
    }
  }

  // If no terminator on either side, no sentence structure — return null
  if (sentStart === 0 && sentEnd === fullText.length) return null;

  let sentence = fullText.substring(sentStart, sentEnd).trim();
  if (!sentence) return null;

  // Truncate if too long
  if (sentence.length > 500) {
    sentence = sentence.substring(0, 500);
  }

  // Replace the word at its exact position with {word} markup
  const wordPosInSentence = wordOffset - sentStart;
  if (
    wordPosInSentence >= 0 &&
    wordPosInSentence + word.length <= sentence.length
  ) {
    sentence =
      sentence.substring(0, wordPosInSentence) +
      "{" +
      word +
      "}" +
      sentence.substring(wordPosInSentence + word.length);
  }

  return sentence;
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
