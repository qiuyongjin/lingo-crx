// entrypoints/content.ts

import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { WordPopup } from "../components/WordPopup";
import { useWordMeaning } from "../hooks/useWordMeaning";
import { extractWordFromPoint } from "../utils/wordExtractor";
import popupCss from "../styles/popup.scss?inline";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  main() {
    let shadowContainer: HTMLDivElement | null = null;
    let reactRoot: ReturnType<typeof createRoot> | null = null;
    let outsideClickListener: ((e: MouseEvent) => void) | null = null;

    function mountPopup(x: number, y: number) {
      // Remove existing popup first
      unmountPopup();

      // Extract the word at the click position
      const wordInfo = extractWordFromPoint(x, y);
      if (!wordInfo) return;

      const { word, sentence } = wordInfo;

      // Calculate position: below the word, 6px gap
      let top = wordInfo.rect.bottom + 6 + window.scrollY;
      let left = wordInfo.rect.left + window.scrollX;

      // If popup would overflow viewport bottom, flip above the word
      const estimatedHeight = 60;
      if (top + estimatedHeight > window.scrollY + window.innerHeight) {
        top = wordInfo.rect.top - 6 - estimatedHeight;
        if (top < window.scrollY) {
          top = wordInfo.rect.bottom + 6 + window.scrollY;
        }
      }

      // Clamp left to prevent overflow off the right side
      const maxLeft = window.scrollX + window.innerWidth - 280;
      left = Math.min(left, Math.max(maxLeft, window.scrollX + 8));

      // Create zero-size anchor div hosting the Shadow DOM
      shadowContainer = document.createElement("div");
      shadowContainer.style.position = "absolute";
      shadowContainer.style.top = "0";
      shadowContainer.style.left = "0";
      shadowContainer.style.width = "0";
      shadowContainer.style.height = "0";
      shadowContainer.style.zIndex = "2147483647";

      const shadowRoot = shadowContainer.attachShadow({ mode: "closed" });

      // Inject isolated styles into the Shadow DOM
      const styleEl = document.createElement("style");
      styleEl.textContent = popupCss;
      shadowRoot.appendChild(styleEl);

      // Create React mount point inside the Shadow DOM
      const mountPoint = document.createElement("div");
      shadowRoot.appendChild(mountPoint);

      document.body.appendChild(shadowContainer);

      // Inline component bridging hook and presentational component
      function PopupApp() {
        const { state, lookup, reset } = useWordMeaning();

        // Fire API lookup once on mount
        useEffect(() => {
          lookup(word, sentence);
        }, [word, sentence]);

        return (
          <WordPopup
            state={state}
            top={top}
            left={left}
            onOpenSettings={() => {
              window.open(chrome.runtime.getURL("options.html"), "_blank");
            }}
          />
        );
      }

      reactRoot = createRoot(mountPoint);
      reactRoot.render(<PopupApp />);

      // Dismiss popup when clicking outside the Shadow DOM
      outsideClickListener = (e: MouseEvent) => {
        if (shadowContainer && !shadowContainer.contains(e.target as Node)) {
          unmountPopup();
        }
      };
      setTimeout(() => {
        document.addEventListener("click", outsideClickListener!, true);
      }, 0);
    }

    function unmountPopup() {
      if (outsideClickListener) {
        document.removeEventListener("click", outsideClickListener, true);
        outsideClickListener = null;
      }
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
      if (shadowContainer) {
        shadowContainer.remove();
        shadowContainer = null;
      }
    }

    // Global click listener — only triggers word lookup when Alt is held
    document.addEventListener(
      "click",
      (e: MouseEvent) => {
        if (shadowContainer?.contains(e.target as Node)) return;

        unmountPopup();

        // Only show popup when Alt (Option) key is held during click
        if (!e.altKey) return;

        mountPopup(e.clientX, e.clientY);
      },
      true
    );
  },
});
