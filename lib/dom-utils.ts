import type { PageInfo } from "./messaging";

export function getPageDimensions(): PageInfo {
  const body = document.body;
  const html = document.documentElement;

  const pageWidth = Math.max(
    body.scrollWidth,
    body.offsetWidth,
    html.clientWidth,
    html.scrollWidth,
    html.offsetWidth,
  );

  const pageHeight = Math.max(
    body.scrollHeight,
    body.offsetHeight,
    html.clientHeight,
    html.scrollHeight,
    html.offsetHeight,
  );

  return {
    pageWidth,
    pageHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    dpr: window.devicePixelRatio,
  };
}

interface SavedElement {
  el: HTMLElement;
  originalVisibility: string;
}

let savedFixedElements: SavedElement[] = [];

export function hideFixedElements(): void {
  savedFixedElements = [];
  const all = document.querySelectorAll("*");

  for (const node of all) {
    const el = node as HTMLElement;
    const style = getComputedStyle(el);
    if (style.position === "fixed" || style.position === "sticky") {
      savedFixedElements.push({
        el,
        originalVisibility: el.style.visibility,
      });
      el.style.visibility = "hidden";
    }
  }
}

export function restoreFixedElements(): void {
  for (const { el, originalVisibility } of savedFixedElements) {
    el.style.visibility = originalVisibility;
  }
  savedFixedElements = [];
}

let savedOverflow: { html: string; body: string } | null = null;

export function unlockOverflow(): void {
  const html = document.documentElement;
  const body = document.body;
  savedOverflow = {
    html: html.style.overflow,
    body: body.style.overflow,
  };
  html.style.overflow = "visible";
  body.style.overflow = "visible";
}

export function restoreOverflow(): void {
  if (savedOverflow) {
    document.documentElement.style.overflow = savedOverflow.html;
    document.body.style.overflow = savedOverflow.body;
    savedOverflow = null;
  }
}

let captureStyleEl: HTMLStyleElement | null = null;

export function injectCaptureStyles(): void {
  captureStyleEl = document.createElement("style");
  captureStyleEl.textContent = `
    *::-webkit-scrollbar { display: none !important; }
    * {
      scrollbar-width: none !important;
      transition-duration: 0s !important;
      animation-duration: 0s !important;
    }
  `;
  document.head.appendChild(captureStyleEl);
}

export function removeCaptureStyles(): void {
  if (captureStyleEl) {
    captureStyleEl.remove();
    captureStyleEl = null;
  }
}
