// entrypoints/content.ts

import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { WordPopup } from "../components/WordPopup";
import { SettingsPanel } from "../components/SettingsPanel";
import { FloatingButton } from "../components/FloatingButton";
import { useWordMeaning } from "../hooks/useWordMeaning";
import { extractWordFromPoint } from "../utils/wordExtractor";
import { getRequireAltKey, getAutoSpeak } from "../utils/storage";
import { addHistoryItem } from "../utils/historyStorage";
import popupCss from "../styles/popup.scss?inline";
import historyCss from "../styles/history.scss?inline";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  main() {
    let shadowContainer: HTMLDivElement | null = null;
    let reactRoot: ReturnType<typeof createRoot> | null = null;
    let outsideClickListener: ((e: MouseEvent) => void) | null = null;
    let escapeKeyListener: ((e: KeyboardEvent) => void) | null = null;

    // --- History system ---
    let historyContainer: HTMLDivElement | null = null;
    let historyRoot: ReturnType<typeof createRoot> | null = null;

    function FabApp() {
      const [visible, setVisible] = useState(true);

      useEffect(() => {
        const listener = (message: any) => {
          if (message.type === "sidePanelState") {
            setVisible(!message.open);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
      }, []);

      if (!visible) return null;

      return (
        <FloatingButton
          onClick={() => {
            chrome.runtime.sendMessage({ type: "openSidePanel" }).catch(() => {
              // Background may not be ready — no-op
            });
          }}
        />
      );
    }

    function mountFloatingButton() {
      if (historyContainer) return; // already mounted

      historyContainer = document.createElement("div");
      historyContainer.style.position = "absolute";
      historyContainer.style.top = "0";
      historyContainer.style.left = "0";
      historyContainer.style.width = "0";
      historyContainer.style.height = "0";
      historyContainer.style.zIndex = "999998";

      const shadowRoot = historyContainer.attachShadow({ mode: "closed" });

      const styleEl = document.createElement("style");
      styleEl.textContent = historyCss;
      shadowRoot.appendChild(styleEl);

      const mountPoint = document.createElement("div");
      shadowRoot.appendChild(mountPoint);

      document.body.appendChild(historyContainer);

      historyRoot = createRoot(mountPoint);
      historyRoot.render(<FabApp />);
    }

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

      // Calculate position: below the word, 6px gap, centered horizontally.
      // Document coordinates — shadow host is position:absolute at document (0,0).
      // Popup widths — WordPopup (split) is sized by its child panels:
      //   popup-padding(14) + panel-left(300) + panel-right(200) + popup-padding(14) = 528px
      // SettingsPanel uses the base .lingo-popup width (300px).
      const wordPopupWidth = 528;
      const settingsPopupWidth = 300;
      const wordCenterX = wordInfo.rect.left + window.scrollX + wordInfo.rect.width / 2;

      let top = wordInfo.rect.bottom + 6 + window.scrollY;
      let wordPopupLeft = wordCenterX - wordPopupWidth / 2;
      let settingsPopupLeft = wordCenterX - settingsPopupWidth / 2;

      // If popup would overflow viewport bottom, flip above the word
      const estimatedHeight = 60;
      if (top + estimatedHeight > window.scrollY + window.innerHeight) {
        top = wordInfo.rect.top - 6 - estimatedHeight + window.scrollY;
        if (top < window.scrollY) {
          top = wordInfo.rect.bottom + 6 + window.scrollY;
        }
      }

      // Clamp horizontal position to keep each popup fully within the viewport
      const wordMinLeft = window.scrollX + 8;
      const wordMaxLeft = window.scrollX + window.innerWidth - wordPopupWidth - 8;
      wordPopupLeft = Math.min(wordMaxLeft, Math.max(wordMinLeft, wordPopupLeft));

      const settingsMinLeft = window.scrollX + 8;
      const settingsMaxLeft = window.scrollX + window.innerWidth - settingsPopupWidth - 8;
      settingsPopupLeft = Math.min(settingsMaxLeft, Math.max(settingsMinLeft, settingsPopupLeft));

      // Arrow horizontal position — points to word center, relative to WordPopup left edge
      let arrowLeft = wordCenterX - wordPopupLeft - 6; // -6: half arrow width so tip aligns with word center
      arrowLeft = Math.min(wordPopupWidth - 12, Math.max(12, arrowLeft));

      // Create zero-size anchor div hosting the Shadow DOM.
      // position:absolute at document (0,0) so the popup scrolls with the page.
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

        // Fire API lookup once on mount, and save to history
        useEffect(() => {
          lookup(word, sentence);
          // Write directly to storage so side panel's onChanged listener picks it up
          if (sentence) {
            addHistoryItem(word, sentence).catch(() => {});
          }
        }, [word, sentence]);

        if (showSettings) {
          return (
            <SettingsPanel
              top={top}
              left={settingsPopupLeft}
              onBack={() => setShowSettings(false)}
            />
          );
        }

        return (
          <WordPopup
            state={state}
            top={top}
            left={wordPopupLeft}
            arrowLeft={arrowLeft}
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

      // Dismiss popup on Escape key
      escapeKeyListener = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          unmountPopup();
        }
      };
      document.addEventListener("keydown", escapeKeyListener);
    }

    function unmountPopup() {
      if (outsideClickListener) {
        document.removeEventListener("click", outsideClickListener, true);
        outsideClickListener = null;
      }
      if (escapeKeyListener) {
        document.removeEventListener("keydown", escapeKeyListener);
        escapeKeyListener = null;
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

    // Check if click target is inside a navigational element (link, area).
    // When the user clicks a link, their intent is navigation, not word lookup.
    function isNavigationalClick(el: Element): boolean {
      let current: Element | null = el;
      while (current) {
        const tag = current.tagName;
        if (
          (tag === "A" &&
            (current as HTMLAnchorElement).hasAttribute("href")) ||
          (tag === "AREA" &&
            (current as HTMLAreaElement).hasAttribute("href"))
        ) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }

    // Timer for debouncing single-click vs double-click.
    // When the user double-clicks, their intent is to select text, not lookup.
    let clickTimer: ReturnType<typeof setTimeout> | null = null;

    // Global click listener — checks Alt key preference before lookup
    document.addEventListener(
      "click",
      async (e: MouseEvent) => {
        if (shadowContainer?.contains(e.target as Node)) return;
        if (historyContainer?.contains(e.target as Node)) return;

        // Clear any pending single-click timer
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }

        unmountPopup();

        // Ignore double-click — user intent is text selection, not word lookup
        if (e.detail > 1) return;

        // Ignore clicks on links — user intent is navigation, not word lookup
        if (isNavigationalClick(e.target as Element)) return;

        const requireAlt = await getRequireAltKey();
        if (requireAlt && !e.altKey) return;

        // Debounce: delay lookup briefly so double-clicks cancel the timer.
        // This prevents the popup from flashing on the first click of a double-click.
        clickTimer = setTimeout(() => {
          clickTimer = null;
          mountPopup(e.clientX, e.clientY);
        }, 300);
      },
      true
    );

    // --- Ctrl-key word lookup ---

    // Track mouse position so we know where the cursor is when Ctrl is released
    let mouseX = 0;
    let mouseY = 0;
    document.addEventListener("mousemove", (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Detect Ctrl pressed alone (not as part of Ctrl+C, Ctrl+V, etc.)
    let ctrlAlone = false;

    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Control" && !e.repeat) {
        ctrlAlone = true;
      } else if (ctrlAlone) {
        // Another key pressed while Ctrl is held — this is a combo, not alone
        ctrlAlone = false;
      }
    });

    document.addEventListener("keyup", (e: KeyboardEvent) => {
      if (e.key !== "Control" || !ctrlAlone) return;
      ctrlAlone = false;

      // Skip if user is typing in an input/textarea/contenteditable
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      // Skip if cursor is over the history system (floating button / panel)
      const el = document.elementFromPoint(mouseX, mouseY);
      if (historyContainer?.contains(el)) return;

      // Reuse existing popup logic at the last known cursor position
      mountPopup(mouseX, mouseY);
    });

    // Mount floating button (opens side panel via background message)
    mountFloatingButton();
  },
});
