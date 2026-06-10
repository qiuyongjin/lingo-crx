// entrypoints/content.ts

import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { WordPopup } from "../components/WordPopup";
import { SettingsPanel } from "../components/SettingsPanel";
import { useWordMeaning } from "../hooks/useWordMeaning";
import { extractWordFromPoint } from "../utils/wordExtractor";
import { getRequireAltKey, getAutoSpeak } from "../utils/storage";
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

      // Auto-speak the word immediately if preference is enabled
      getAutoSpeak().then((enabled) => {
        if (enabled && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(word);
          utterance.lang = "en-US";
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      });

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
      shadowContainer.style.zIndex = "999999";

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
        const [showSettings, setShowSettings] = useState(false);

        // Fire API lookup once on mount
        useEffect(() => {
          lookup(word, sentence);
        }, [word, sentence]);

        if (showSettings) {
          return (
            <SettingsPanel
              top={top}
              left={left}
              onBack={() => setShowSettings(false)}
            />
          );
        }

        return (
          <WordPopup
            state={state}
            top={top}
            left={left}
            onToggleSettings={() => setShowSettings(true)}
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

    // Global click listener — checks Alt key preference before lookup
    document.addEventListener(
      "click",
      async (e: MouseEvent) => {
        if (shadowContainer?.contains(e.target as Node)) return;

        unmountPopup();

        const requireAlt = await getRequireAltKey();
        if (requireAlt && !e.altKey) return;

        mountPopup(e.clientX, e.clientY);
      },
      true
    );
  },
});
