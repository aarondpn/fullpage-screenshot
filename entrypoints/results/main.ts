import { sendMessage } from "@/lib/messaging";
import type { LastCaptureData } from "@/lib/messaging";
import { stitchCaptures } from "@/lib/stitcher";
import { canvasToBlob, downloadBlob, copyToClipboard, formatFileSize, type ImageFormat } from "@/lib/formats";
import { generateThumbnail } from "@/lib/thumbnail";
import {
  addHistoryEntry, getHistory, deleteHistoryEntry, clearHistory,
  getSettings, saveSettings, type HistoryEntry, type UserSettings,
} from "@/lib/storage";
import { initTheme, cycleTheme, getThemeIcon } from "@/lib/theme";

// --- DOM: Top bar ---
const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement;

// --- DOM: Tabs ---
const tabs = document.querySelectorAll<HTMLButtonElement>(".tab-bar .tab");
const panels = document.querySelectorAll<HTMLElement>(".tab-panel");

// --- DOM: Result tab ---
const loadingEl = document.getElementById("loading")!;
const resultView = document.getElementById("result-view")!;
const pageUrl = document.getElementById("page-url")!;
const captureInfo = document.getElementById("capture-info")!;
const multiTileWarning = document.getElementById("multi-tile-warning")!;
const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
const pdfBtn = document.getElementById("pdf-btn") as HTMLButtonElement;
const tilesContainer = document.getElementById("tiles-container")!;

// --- DOM: History tab ---
const historyList = document.getElementById("history-list")!;
const clearHistoryBtn = document.getElementById("clear-history-btn") as HTMLButtonElement;

// --- DOM: Settings tab ---
const formatSelect = document.getElementById("format-select") as HTMLSelectElement;
const qualityRow = document.getElementById("quality-row")!;
const qualitySlider = document.getElementById("quality-slider") as HTMLInputElement;
const qualityValue = document.getElementById("quality-value")!;
const resolutionSelect = document.getElementById("resolution-select") as HTMLSelectElement;
const autoCaptureToggle = document.getElementById("auto-capture-toggle") as HTMLInputElement;
const autoCaptureLabel = document.getElementById("auto-capture-label")!;

let currentBlobs: Blob[] = [];
let currentFormat: ImageFormat = "png";
let currentTimestamp = "";

// ============================================================
// Tabs
// ============================================================
function switchTab(tabName: string) {
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tabName));
  panels.forEach((p) => p.classList.toggle("active", p.id === `tab-${tabName}`));

  if (tabName === "history") renderHistory();
}

tabs.forEach((t) => {
  t.addEventListener("click", () => switchTab(t.dataset.tab!));
});

// ============================================================
// Theme
// ============================================================
initTheme().then((theme) => {
  themeToggle.textContent = getThemeIcon(theme);
});

themeToggle.addEventListener("click", async () => {
  const next = await cycleTheme();
  themeToggle.textContent = getThemeIcon(next);
});

// ============================================================
// Settings
// ============================================================
async function loadSettings() {
  const s = await getSettings();
  formatSelect.value = s.format;
  qualitySlider.value = String(s.quality);
  qualityValue.textContent = `${Math.round(s.quality * 100)}%`;
  resolutionSelect.value = s.resolution;
  qualityRow.classList.toggle("hidden", s.format !== "jpeg");
  autoCaptureToggle.checked = s.autoCapture;
  autoCaptureLabel.textContent = s.autoCapture ? "On" : "Off";
}

function currentSettingsValues(): UserSettings {
  return {
    format: formatSelect.value as ImageFormat,
    quality: Number(qualitySlider.value),
    resolution: resolutionSelect.value as "full" | "standard",
    autoCapture: autoCaptureToggle.checked,
  };
}

function persistSettings() {
  saveSettings(currentSettingsValues());
}

loadSettings();

formatSelect.addEventListener("change", () => {
  qualityRow.classList.toggle("hidden", formatSelect.value !== "jpeg");
  persistSettings();
});

qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = `${Math.round(Number(qualitySlider.value) * 100)}%`;
  persistSettings();
});

resolutionSelect.addEventListener("change", persistSettings);

autoCaptureToggle.addEventListener("change", () => {
  autoCaptureLabel.textContent = autoCaptureToggle.checked ? "On" : "Off";
  persistSettings();
});

// ============================================================
// Result — load capture data
// ============================================================
async function init() {
  let data: LastCaptureData | null = null;
  try {
    data = await sendMessage("getLastCapture", undefined);
  } catch {
    loadingEl.textContent = "Failed to retrieve capture data.";
    return;
  }

  if (!data) {
    loadingEl.textContent = "No capture data available.";
    switchTab("history");
    return;
  }

  const { captureResult, tabUrl, tabTitle, format, quality } = data;
  currentFormat = format;
  currentTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  // Stitch captures
  loadingEl.textContent = "Stitching image...";
  const { dataUrls, scrollPositions, pageInfo } = captureResult;
  const { canvases } = await stitchCaptures(dataUrls, pageInfo, scrollPositions);

  // Generate blobs
  currentBlobs = await Promise.all(
    canvases.map((c) => canvasToBlob(c, format, quality)),
  );

  // Build info
  const totalSize = currentBlobs.reduce((sum, b) => sum + b.size, 0);
  const totalHeight = canvases.reduce((sum, c) => sum + c.height, 0);
  const firstWidth = canvases[0].width;

  pageUrl.textContent = tabUrl;
  let info = `${firstWidth} \u00d7 ${totalHeight}px \u00b7 ${formatFileSize(totalSize)} \u00b7 ${format.toUpperCase()}`;
  if (canvases.length > 1) {
    info += ` \u00b7 ${canvases.length} images`;
  }
  captureInfo.textContent = info;

  // Multi-tile: show warning, hide copy (clipboard only supports one image)
  if (canvases.length > 1) {
    multiTileWarning.classList.remove("hidden");
    copyBtn.classList.add("hidden");
  }

  // Render tiles
  tilesContainer.innerHTML = "";
  for (let i = 0; i < canvases.length; i++) {
    const blob = currentBlobs[i];
    const wrapper = document.createElement("div");
    wrapper.className = "tile-wrapper";

    if (canvases.length > 1) {
      const label = document.createElement("div");
      label.className = "tile-label";
      label.innerHTML = `<span>Image ${i + 1} of ${canvases.length}</span>`;
      const tileDownload = document.createElement("button");
      tileDownload.className = "tile-download";
      tileDownload.textContent = "Download";
      tileDownload.addEventListener("click", () => {
        const ext = format === "jpeg" ? "jpg" : "png";
        downloadBlob(blob, `screenshot-${currentTimestamp}-${i + 1}.${ext}`);
      });
      label.appendChild(tileDownload);
      wrapper.appendChild(label);
    }

    const container = document.createElement("div");
    container.className = "preview-container";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.alt = `Screenshot tile ${i + 1}`;
    container.appendChild(img);

    container.addEventListener("click", () => {
      container.classList.toggle("zoomed");
    });

    wrapper.appendChild(container);
    tilesContainer.appendChild(wrapper);
  }

  // Show result, hide loading
  loadingEl.classList.add("hidden");
  resultView.classList.remove("hidden");

  // Save to history
  const thumbnail = generateThumbnail(canvases[0]);
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    url: tabUrl,
    title: tabTitle,
    timestamp: Date.now(),
    width: firstWidth,
    height: totalHeight,
    fileSize: totalSize,
    format,
    tileCount: canvases.length,
    thumbnailDataUrl: thumbnail,
  };
  await addHistoryEntry(entry);
}

// ============================================================
// Download
// ============================================================
downloadBtn.addEventListener("click", () => {
  if (currentBlobs.length === 0) return;
  const ext = currentFormat === "jpeg" ? "jpg" : "png";

  if (currentBlobs.length === 1) {
    downloadBlob(currentBlobs[0], `screenshot-${currentTimestamp}.${ext}`);
  } else {
    for (let i = 0; i < currentBlobs.length; i++) {
      downloadBlob(currentBlobs[i], `screenshot-${currentTimestamp}-${i + 1}.${ext}`);
    }
  }
});

// ============================================================
// Copy to clipboard
// ============================================================
copyBtn.addEventListener("click", async () => {
  if (currentBlobs.length !== 1) return;

  let blob = currentBlobs[0];
  if (currentFormat === "jpeg") {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    blob = await canvasToBlob(canvas, "png");
  }

  try {
    await copyToClipboard(blob);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy to Clipboard"), 2000);
  } catch {
    copyBtn.textContent = "Failed";
    setTimeout(() => (copyBtn.textContent = "Copy to Clipboard"), 2000);
  }
});

// ============================================================
// PDF export
// ============================================================
pdfBtn.addEventListener("click", async () => {
  if (currentBlobs.length === 0) return;
  pdfBtn.textContent = "Generating...";
  pdfBtn.disabled = true;
  try {
    const { exportToPdf } = await import("@/lib/pdf");
    await exportToPdf(currentBlobs, `screenshot-${currentTimestamp}.pdf`);
  } finally {
    pdfBtn.textContent = "Download PDF";
    pdfBtn.disabled = false;
  }
});

// ============================================================
// History
// ============================================================
async function renderHistory() {
  const entries = await getHistory();
  historyList.innerHTML = "";

  if (entries.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No captures yet.</p>';
    return;
  }

  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "history-entry";

    const thumb = document.createElement("img");
    thumb.className = "history-thumb";
    thumb.src = entry.thumbnailDataUrl;
    thumb.alt = "";

    const meta = document.createElement("div");
    meta.className = "history-meta";
    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = entry.title || entry.url;
    const details = document.createElement("div");
    details.className = "history-details";
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    details.textContent = `${entry.width}\u00d7${entry.height} \u00b7 ${formatFileSize(entry.fileSize)} \u00b7 ${dateStr}`;
    meta.appendChild(title);
    meta.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const urlBtn = document.createElement("button");
    urlBtn.textContent = "Open URL";
    urlBtn.addEventListener("click", () => {
      browser.tabs.create({ url: entry.url });
    });

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      await deleteHistoryEntry(entry.id);
      renderHistory();
    });

    actions.appendChild(urlBtn);
    actions.appendChild(delBtn);

    row.appendChild(thumb);
    row.appendChild(meta);
    row.appendChild(actions);
    historyList.appendChild(row);
  }
}

clearHistoryBtn.addEventListener("click", async () => {
  if (!confirm("Clear all capture history?")) return;
  await clearHistory();
  renderHistory();
});

// ============================================================
// Start
// ============================================================
init();
