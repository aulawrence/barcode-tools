import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument as PdfLibDocument, StandardFonts, rgb } from "pdf-lib";

import { decodeImage, drawOverlay, positionToRect, type ReadResult } from "./barcode-reader";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Resolution used both for on-screen decoding and for the annotate-export
// render pass. Higher = better odds of decoding small barcodes, slower.
const RENDER_SCALE = 2;

export interface PdfSession {
  doc: PDFDocumentProxy;
  /** Original file bytes, kept because pdfjs-dist takes ownership of/detaches whatever buffer it's given. */
  bytes: Uint8Array;
  numPages: number;
}

export async function openPdf(file: File): Promise<PdfSession> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  return { doc, bytes, numPages: doc.numPages };
}

/** Renders one page to the given canvas at decode resolution, decodes it, and draws the overlay. */
export async function renderAndDecodePage(
  session: PdfSession,
  pageNum: number,
  canvas: HTMLCanvasElement,
): Promise<ReadResult[]> {
  const page = await session.doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;

  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const results = await decodeImage(imageData);
  drawOverlay(ctx, canvas.width, results);
  return results;
}

export interface AnnotateProgress {
  page: number;
  totalPages: number;
  foundSoFar: number;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Re-renders every page, decodes it, and draws vector boxes + labels onto a
 * copy of the *original* PDF (via pdf-lib), so the source content stays
 * intact. Returns "aborted" if `signal` fires mid-scan.
 */
export async function annotatePdf(
  session: PdfSession,
  onProgress: (p: AnnotateProgress) => void,
  signal: AbortSignal,
): Promise<Uint8Array | "aborted"> {
  const pdfLibDoc = await PdfLibDocument.load(session.bytes.slice());
  const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
  const pdfLibPages = pdfLibDoc.getPages();
  const color = rgb(0.96, 0.36, 0);

  const scratchCanvas = document.createElement("canvas");
  const scratchCtx = scratchCanvas.getContext("2d")!;

  let foundSoFar = 0;

  for (let pageNum = 1; pageNum <= session.numPages; pageNum++) {
    if (signal.aborted) return "aborted";
    onProgress({ page: pageNum, totalPages: session.numPages, foundSoFar });

    const page = await session.doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    scratchCanvas.width = viewport.width;
    scratchCanvas.height = viewport.height;
    await page.render({ canvas: scratchCanvas, viewport }).promise;

    const imageData = scratchCtx.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height);
    const results = await decodeImage(imageData);
    if (signal.aborted) return "aborted";

    foundSoFar += results.length;
    const pdfLibPage = pdfLibPages[pageNum - 1];
    const { height: pageHeightPts } = pdfLibPage.getSize();

    for (const r of results) {
      const rect = positionToRect(r.position);
      const x = rect.left / RENDER_SCALE;
      const width = rect.width / RENDER_SCALE;
      const height = rect.height / RENDER_SCALE;
      // pdf-lib's y is the bottom-left corner in bottom-up page space; the
      // rendered raster is top-down, so flip around the page height.
      const y = pageHeightPts - rect.top / RENDER_SCALE - height;

      pdfLibPage.drawRectangle({ x, y, width, height, borderColor: color, borderWidth: 1 });

      const label = `${r.format}${r.symbologyIdentifier ? ` (${r.symbologyIdentifier})` : ""}${
        r.readerInit ? " [READER PROGRAMMING]" : ""
      }`;
      pdfLibPage.drawText(truncate(label, 90), { x, y: y + height + 8, size: 6, font, color });
      pdfLibPage.drawText(truncate(r.text || "(binary payload)", 90), {
        x,
        y: y + height + 1,
        size: 6,
        font,
        color,
      });
    }
  }

  onProgress({ page: session.numPages, totalPages: session.numPages, foundSoFar });
  return pdfLibDoc.save();
}
