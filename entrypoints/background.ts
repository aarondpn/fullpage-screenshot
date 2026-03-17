import { sendMessage, onMessage, type CaptureResult, type LastCaptureData } from "@/lib/messaging";

// Chrome limits captureVisibleTab to ~2 calls/sec
const MIN_CAPTURE_INTERVAL_MS = 550;
const SCROLL_SETTLE_MS = 150;
const MAX_RETRIES = 3;

// Infinite-scroll safeguards
const MAX_CAPTURE_SLICES = 80;
const MAX_CAPTURE_TIME_MS = 60_000;
const MAX_HEIGHT_GROWTH = 1.5; // stop if page grows 50% beyond initial measurement

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastCaptureTime = 0;
let lastCaptureData: LastCaptureData | null = null;

export default defineBackground(() => {
  // Handle getLastCapture requests from results page
  onMessage("getLastCapture", () => {
    return lastCaptureData;
  });

  // Port-based messaging for capture lifecycle (progress + result)
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "capture") return;

    let aborted = false;
    port.onDisconnect.addListener(() => { aborted = true; });

    port.onMessage.addListener(async (message) => {
      if (message.type !== "startCapture") return;

      try {
        const result = await handleCapture(
          message.tabId,
          message.options,
          (current, total) => {
            try { port.postMessage({ type: "captureProgress", current, total }); } catch {}
          },
          () => aborted,
        );

        if (aborted) return;

        if (!result.error) {
          // Store capture data for results page
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          const tab = tabs[0];
          lastCaptureData = {
            captureResult: result,
            tabUrl: tab?.url || "",
            tabTitle: tab?.title || "Screenshot",
            format: message.options.format,
            quality: message.options.quality,
          };

          // Open results page in new tab
          browser.tabs.create({
            url: browser.runtime.getURL("/results.html"),
          });
        }

        try { port.postMessage({ type: "captureResult", result }); } catch {}
      } catch (err: any) {
        if (!aborted) {
          try { port.postMessage({ type: "captureResult", result: { error: err.message } }); } catch {}
        }
      }
    });
  });
});

interface CaptureOptions {
  format: "png" | "jpeg";
  quality: number;
}

async function captureTab(options: CaptureOptions): Promise<string> {
  // Throttle to stay under Chrome's rate limit
  const elapsed = Date.now() - lastCaptureTime;
  if (elapsed < MIN_CAPTURE_INTERVAL_MS) {
    await delay(MIN_CAPTURE_INTERVAL_MS - elapsed);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastCaptureTime = Date.now();
      return await browser.tabs.captureVisibleTab(undefined, {
        format: options.format === "jpeg" ? "jpeg" : "png",
        quality: options.format === "jpeg" ? Math.round(options.quality * 100) : undefined,
      });
    } catch (err: any) {
      if (attempt < MAX_RETRIES && err?.message?.includes("MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND")) {
        await delay(MIN_CAPTURE_INTERVAL_MS * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error("captureVisibleTab failed after retries");
}

async function handleCapture(
  tabId: number,
  options: CaptureOptions,
  onProgress?: (current: number, total: number) => void,
  isAborted?: () => boolean,
): Promise<CaptureResult> {
  // 0. Ensure content script is injected (handles tabs opened before install)
  try {
    await sendMessage("getPageInfo", undefined, tabId);
  } catch {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ["/content-scripts/capture.js"],
      });
      await delay(100);
    } catch (injectErr: any) {
      // file:// URLs require "Allow access to file URLs" in extension settings
      const tab = await browser.tabs.get(tabId);
      if (tab.url?.startsWith("file://")) {
        throw new Error(
          'Cannot access file URLs. Enable "Allow access to file URLs" on the extension\'s details page.',
        );
      }
      throw injectErr;
    }
  }

  // 1. Get page dimensions
  const pageInfo = await sendMessage("getPageInfo", undefined, tabId);
  const { viewportHeight } = pageInfo;

  const initialPageHeight = pageInfo.pageHeight;
  const totalSlices = Math.min(
    Math.ceil(initialPageHeight / viewportHeight),
    MAX_CAPTURE_SLICES,
  );

  // 2. Prepare capture: inject styles (kill transitions/animations, hide scrollbars,
  //    unlock overflow) but keep fixed elements visible for the first capture
  await sendMessage("prepareCapture", undefined, tabId);

  // 3. Scroll to top and wait for repaint + overlay scrollbar fade
  await sendMessage("scrollTo", { y: 0 }, tabId);
  await sendMessage("waitForRepaint", undefined, tabId);
  await delay(500);

  // 4. Capture loop with infinite-scroll safeguards
  const dataUrls: string[] = [];
  const scrollPositions: number[] = [];
  const startTime = Date.now();
  let capturedSlices = 0;

  try {
    for (let i = 0; i < totalSlices; i++) {
      // Abort check
      if (isAborted?.()) break;

      // Time limit
      if (Date.now() - startTime > MAX_CAPTURE_TIME_MS) break;

      const y = i * viewportHeight;
      const { actualY } = await sendMessage("scrollTo", { y }, tabId);
      scrollPositions.push(actualY);
      await delay(SCROLL_SETTLE_MS);

      // Height growth detection — infinite scroll pages keep growing
      if (i > 0 && i % 10 === 0) {
        const current = await sendMessage("getPageInfo", undefined, tabId);
        if (current.pageHeight > initialPageHeight * MAX_HEIGHT_GROWTH) break;
      }

      dataUrls.push(await captureTab(options));
      capturedSlices++;

      // After the first capture, hide fixed/sticky elements so they
      // don't repeat in subsequent viewport captures
      if (i === 0) {
        await sendMessage("hideFixedElements", undefined, tabId);
      }

      onProgress?.(i + 1, totalSlices);
    }
  } finally {
    // 5. Restore everything
    await sendMessage("restoreAll", undefined, tabId);
    await sendMessage("scrollTo", { y: 0 }, tabId);
  }

  // Report the height we actually captured, not the full page
  const capturedHeight = Math.min(capturedSlices * viewportHeight, initialPageHeight);

  return {
    dataUrls,
    scrollPositions,
    pageInfo: { ...pageInfo, pageHeight: capturedHeight },
  };
}
