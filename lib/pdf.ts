import { jsPDF } from "jspdf";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// PDF spec (ISO 32000) limits page dimensions to 14400 user units = 200 inches
const MAX_PDF_PT = 14400;

/**
 * Exports one or more image blobs as a single-page PDF.
 * Tiles are placed at exact cumulative Y offsets with no gaps,
 * producing a seamless continuous image in the PDF.
 *
 * If the combined pixel dimensions exceed the PDF spec's 14400pt
 * page limit, coordinates are scaled down proportionally. The
 * embedded image data stays at full resolution — only the page
 * layout dimensions shrink, so zooming in the PDF viewer still
 * shows full detail.
 */
export async function exportToPdf(
  blobs: Blob[],
  filename: string,
): Promise<void> {
  const dataUrls = await Promise.all(blobs.map(blobToDataUrl));
  const images = await Promise.all(dataUrls.map(loadImage));

  const pxWidth = images[0].width;
  const pxHeight = images.reduce((sum, img) => sum + img.height, 0);

  // Scale so the largest dimension fits within the PDF spec limit
  const scale = Math.min(1, MAX_PDF_PT / Math.max(pxWidth, pxHeight));
  const pageW = pxWidth * scale;
  const pageH = pxHeight * scale;

  const doc = new jsPDF({
    orientation: pageW > pageH ? "l" : "p",
    unit: "pt",
    format: [pageW, pageH],
  });

  let yOffset = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const fmt = blobs[i].type === "image/jpeg" ? "JPEG" : "PNG";
    const w = img.width * scale;
    const h = img.height * scale;
    doc.addImage(dataUrls[i], fmt, 0, yOffset, w, h, undefined, "FAST");
    yOffset += h;
  }

  doc.save(filename);
}
