import type { PageInfo } from "./messaging";

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export const MAX_CANVAS_DIMENSION = 16384;

export interface StitchResult {
  canvases: HTMLCanvasElement[];
}

export async function stitchCaptures(
  dataUrls: string[],
  pageInfo: PageInfo,
  scrollPositions: number[],
  effectiveDpr: number = pageInfo.dpr,
): Promise<StitchResult> {
  const { pageWidth, pageHeight, dpr } = pageInfo;

  // Scale factor from captured DPR to desired output DPR
  const scale = effectiveDpr / dpr;

  const fullWidth = Math.round(pageWidth * effectiveDpr);
  const fullHeight = Math.round(pageHeight * effectiveDpr);

  // Split into tiles if height exceeds canvas limit
  const tileCount = Math.ceil(fullHeight / MAX_CANVAS_DIMENSION);
  const canvasWidth = Math.min(fullWidth, MAX_CANVAS_DIMENSION);

  // Pre-load all images
  const images = await Promise.all(dataUrls.map(loadImage));

  const canvases: HTMLCanvasElement[] = [];

  for (let t = 0; t < tileCount; t++) {
    const tileTopPx = t * MAX_CANVAS_DIMENSION;
    const tileHeight = Math.min(MAX_CANVAS_DIMENSION, fullHeight - tileTopPx);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = tileHeight;
    const ctx = canvas.getContext("2d")!;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const actualScrollY = scrollPositions[i] ?? 0;

      // Image position in output coordinates
      const imgTop = Math.round(actualScrollY * effectiveDpr);
      const imgScaledHeight = Math.round(img.height * scale);
      const imgBottom = imgTop + imgScaledHeight;

      // Skip captures that don't overlap with this tile
      if (imgBottom <= tileTopPx || imgTop >= tileTopPx + tileHeight) continue;

      // Calculate overlap region in output coordinates
      const overlapTop = Math.max(imgTop, tileTopPx);
      const overlapBottom = Math.min(imgBottom, tileTopPx + tileHeight);
      const overlapHeight = overlapBottom - overlapTop;

      // Map back to source image coordinates
      const srcY = Math.round((overlapTop - imgTop) / scale);
      const srcHeight = Math.round(overlapHeight / scale);
      const dstY = overlapTop - tileTopPx;

      ctx.drawImage(
        img,
        0, srcY,
        img.width, srcHeight,
        0, dstY,
        canvasWidth, overlapHeight,
      );
    }

    canvases.push(canvas);
  }

  return { canvases };
}
