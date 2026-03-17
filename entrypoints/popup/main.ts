import { getSettings } from "@/lib/storage";

// DOM elements
const captureBtn = document.getElementById("capture-btn") as HTMLButtonElement;
const progressSection = document.getElementById("progress-section")!;
const progressLabel = document.getElementById("progress-label")!;
const progressBar = document.getElementById("progress-bar")!;
const progressText = document.getElementById("progress-text")!;
const cancelBtn = document.getElementById("cancel-btn") as HTMLButtonElement;
const errorSection = document.getElementById("error-section")!;
const errorMessage = document.getElementById("error-message")!;

let cancelled = false;
let activePort: ReturnType<typeof browser.runtime.connect> | null = null;

function updateProgress(current: number, total: number) {
  progressBar.style.width = `${(current / total) * 100}%`;
  progressText.textContent = `${current}/${total}`;
  progressLabel.textContent = `Capturing page... (${current}/${total})`;
}

function showError(msg: string) {
  errorMessage.textContent = msg;
  errorSection.classList.remove("hidden");
}

function resetUI() {
  cancelled = false;
  captureBtn.disabled = false;
  captureBtn.classList.remove("hidden");
  progressSection.classList.add("hidden");
  errorSection.classList.add("hidden");
  progressBar.style.width = "0%";
}

async function startCapture() {
  cancelled = false;
  errorSection.classList.add("hidden");

  // Get active tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    showError("No active tab found.");
    return;
  }

  // Check for restricted URLs
  const url = tab.url || "";
  const isHttp = url.startsWith("http://") || url.startsWith("https://");
  const isFile = url.startsWith("file://");
  if (!isHttp && !isFile) {
    showError("Cannot capture this page. Screenshots only work on web pages and local files.");
    return;
  }

  // Read settings from storage (configured via results page Settings tab)
  const settings = await getSettings();

  // Show progress UI
  captureBtn.classList.add("hidden");
  progressSection.classList.remove("hidden");
  progressLabel.textContent = "Capturing page...";
  updateProgress(0, 1);

  // Use port-based messaging for reliable progress updates
  const port = browser.runtime.connect({ name: "capture" });
  activePort = port;

  port.onMessage.addListener((message) => {
    if (cancelled) return;

    if (message.type === "captureProgress") {
      updateProgress(message.current, message.total);
    } else if (message.type === "captureResult") {
      activePort = null;
      port.disconnect();
      if (message.result?.error) {
        resetUI();
        showError(message.result.error);
      } else {
        // Background handles opening results page — just reset popup
        resetUI();
      }
    }
  });

  port.postMessage({
    type: "startCapture",
    tabId: tab.id,
    options: { format: settings.format, quality: settings.quality },
  });
}

// Manual capture
captureBtn.addEventListener("click", startCapture);

// Cancel — disconnecting the port signals the background to stop
cancelBtn.addEventListener("click", () => {
  cancelled = true;
  if (activePort) {
    activePort.disconnect();
    activePort = null;
  }
  resetUI();
});

// Auto-capture on popup open
getSettings().then((settings) => {
  if (settings.autoCapture) {
    captureBtn.classList.add("hidden");
    startCapture();
  }
});
