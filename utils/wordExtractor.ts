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

  // Find word boundaries using Unicode-aware character classes.
  // \p{L} = any letter (Latin, CJK, Cyrillic, Arabic, etc., including accented letters)
  // \p{N} = any numeric digit
  // Also treat hyphen and apostrophes as word-internal characters.
  // ’ = ‘, ‘ = ‘ (curly/smart apostrophes), ‘ = ‘ (straight)
  const wordRegex = /[\p{L}\p{N}_\-’‘’]/u;
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

  let word = text.slice(start, end);

  // Strip leading/trailing hyphens and apostrophes (they're word-internal only)
  word = word.replace(/^[\-''‘’]+|[\-''‘’]+$/g, "");

  if (!word || word.length === 0 || word.length > 50) return null;

  // Get bounding rect for the word
  const wordRange = document.createRange();
  wordRange.setStart(node, start);
  wordRange.setEnd(node, end);
  const rect = wordRange.getBoundingClientRect();

  // Guard: if the click point is far from the word's bounding rect,
  // the user clicked on blank space and caretRangeFromPoint just found
  // a nearby text node. Skip to avoid spurious API calls.
  const CLICK_TOLERANCE = 6;
  if (
    x < rect.left - CLICK_TOLERANCE ||
    x > rect.right + CLICK_TOLERANCE ||
    y < rect.top - CLICK_TOLERANCE ||
    y > rect.bottom + CLICK_TOLERANCE
  ) {
    return null;
  }

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
 * Extract the context surrounding the word from the containing block element.
 * Three-tier fallback for robustness across any HTML structure:
 *   1. Sentence extraction by terminators (. 。 ! ！ ? ？)
 *   2. Context window (±100 chars) when no terminators found
 *   3. Smart truncation: if >500 chars, center around the marked word
 * Returns null only when no block ancestor or no text content is available.
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

  // ---- Tier 1: Search for sentence boundaries ----
  let sentStart = 0;
  let foundLeft = false;
  for (let i = wordOffset - 1; i >= 0; i--) {
    if (SENTENCE_TERMINATOR.test(fullText[i])) {
      sentStart = i + 1;
      foundLeft = true;
      break;
    }
  }

  let sentEnd = fullText.length;
  let foundRight = false;
  for (let i = wordOffset + word.length; i < fullText.length; i++) {
    if (SENTENCE_TERMINATOR.test(fullText[i])) {
      sentEnd = i + 1; // include the terminator
      foundRight = true;
      break;
    }
  }

  // ---- Tier 2: Fallback to context window ----
  if (!foundLeft && !foundRight) {
    const CONTEXT_RADIUS = 100;
    sentStart = Math.max(0, wordOffset - CONTEXT_RADIUS);
    sentEnd = Math.min(fullText.length, wordOffset + word.length + CONTEXT_RADIUS);
  }

  // ---- Build marked context ----
  return buildMarkedContext(fullText, sentStart, sentEnd, wordOffset, word);
}

/**
 * Extract, trim, truncate, and mark the target word with {} in a context string.
 */
function buildMarkedContext(
  fullText: string,
  start: number,
  end: number,
  wordOffset: number,
  word: string
): string | null {
  const raw = fullText.substring(start, end);
  let context = raw.trim();
  if (!context) return null;

  // Position of the word within the trimmed context
  const leftTrim = raw.indexOf(context);
  let wordPos = wordOffset - start - leftTrim;

  // ---- Tier 3: Smart truncation, keeping the word centered ----
  if (context.length > 500) {
    const wordCenter = wordPos + word.length / 2;
    const half = 250;
    let truncStart = Math.max(0, Math.floor(wordCenter - half));
    let truncEnd = Math.min(context.length, truncStart + 500);
    if (truncEnd - truncStart < 500) {
      truncStart = Math.max(0, truncEnd - 500);
    }
    context = context.substring(truncStart, truncEnd);
    wordPos -= truncStart;
  }

  // Mark the target word with {}
  if (
    wordPos >= 0 &&
    wordPos + word.length <= context.length
  ) {
    context =
      context.substring(0, wordPos) +
      "{" +
      word +
      "}" +
      context.substring(wordPos + word.length);
  }

  return context;
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
