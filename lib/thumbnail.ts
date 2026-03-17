export function generateThumbnail(canvas: HTMLCanvasElement, maxWidth = 150): string {
  const scale = maxWidth / canvas.width;
  const thumbWidth = maxWidth;
  const thumbHeight = Math.min(Math.round(canvas.height * scale), 200);

  const thumb = document.createElement("canvas");
  thumb.width = thumbWidth;
  thumb.height = thumbHeight;
  const ctx = thumb.getContext("2d")!;

  // Draw cropped to top portion if needed
  const srcHeight = Math.min(canvas.height, thumbHeight / scale);
  ctx.drawImage(canvas, 0, 0, canvas.width, srcHeight, 0, 0, thumbWidth, thumbHeight);

  return thumb.toDataURL("image/jpeg", 0.6);
}
