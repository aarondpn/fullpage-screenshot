import { onMessage } from "@/lib/messaging";
import {
  getPageDimensions,
  hideFixedElements,
  restoreFixedElements,
  unlockOverflow,
  restoreOverflow,
  injectCaptureStyles,
  removeCaptureStyles,
} from "@/lib/dom-utils";
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    onMessage("getPageInfo", () => {
      return getPageDimensions();
    });

    onMessage("scrollTo", ({ data }) => {
      window.scrollTo({ top: data.y, behavior: "instant" });
      return { actualY: window.scrollY };
    });

    // Inject capture styles (kill transitions, hide scrollbars, unlock overflow)
    // but leave fixed elements visible for the first capture
    onMessage("prepareCapture", () => {
      injectCaptureStyles();
      unlockOverflow();
    });

    // Hide fixed/sticky elements (called after the first capture)
    onMessage("hideFixedElements", () => {
      hideFixedElements();
    });

    onMessage("restoreAll", () => {
      restoreFixedElements();
      restoreOverflow();
      removeCaptureStyles();
    });

    onMessage("waitForRepaint", () => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });
  },
});
