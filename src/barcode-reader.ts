import { prepareZXingModule, readBarcodes, type ReadResult, type ReadInputBarcodeFormat } from "zxing-wasm/reader";
import zxingReaderWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// Self-host the wasm binary instead of the library's default (jsDelivr CDN)
// fetch, so decoding works fully offline once the page has loaded.
prepareZXingModule({
  overrides: {
    locateFile: (path) => (path.endsWith(".wasm") ? zxingReaderWasmUrl : path),
  },
});

export type { ReadResult };
export { barcodeFormats, type ReadInputBarcodeFormat } from "zxing-wasm/reader";

// Applies to every decodeImage() call (image/PDF/video/camera) until
// changed again; an empty list means "all supported formats", matching
// zxing-wasm's own default.
let activeFormats: ReadInputBarcodeFormat[] = [];

export function setActiveFormats(formats: ReadInputBarcodeFormat[]) {
  activeFormats = formats;
}

export async function decodeImage(input: Blob | ImageData): Promise<ReadResult[]> {
  return readBarcodes(input, {
    tryHarder: true,
    maxNumberOfSymbols: 32,
    // Deliberately not returnErrors: true — that makes zxing-cpp also
    // return checksum-failed *candidate* detections (common on blurry/
    // partial camera frames), which would otherwise surface as bogus
    // "found" results (e.g. ChecksumError @ ODCode128Reader.cpp) and, in
    // video/camera scanning, incorrectly stop the scan on garbage.
    returnErrors: false,
    textMode: "Escaped",
    formats: activeFormats,
  });
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Axis-aligned bounding box over a (possibly slightly rotated) barcode's four corners. */
export function positionToRect(position: ReadResult["position"]): Rect {
  const xs = [position.topLeft.x, position.topRight.x, position.bottomLeft.x, position.bottomRight.x];
  const ys = [position.topLeft.y, position.topRight.y, position.bottomLeft.y, position.bottomRight.y];
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

export function formatBytes(bytes: Uint8Array): { hex: string; escaped: string } {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  const escaped = Array.from(bytes)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, "0")}`))
    .join("");
  return { hex, escaped };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Draws bounding quadrilaterals + index/format labels for each result onto a canvas context. */
export function drawOverlay(ctx: CanvasRenderingContext2D, referenceWidth: number, results: ReadResult[]) {
  ctx.lineWidth = Math.max(2, referenceWidth / 400);
  ctx.strokeStyle = "#ff5c00";
  ctx.fillStyle = "#ff5c00";
  ctx.font = `${Math.max(14, Math.round(referenceWidth / 60))}px monospace`;
  ctx.textBaseline = "bottom";

  results.forEach((r, i) => {
    const { topLeft, topRight, bottomRight, bottomLeft } = r.position;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillText(`#${i + 1} ${r.format}`, topLeft.x, Math.max(0, topLeft.y - 4));
  });
}

/** Renders the per-barcode detail cards (text, raw bytes, reader-init flag, position) into a container. */
export function renderResultCards(container: HTMLElement, results: ReadResult[]) {
  container.innerHTML = "";
  results.forEach((r, i) => {
    const { topLeft, topRight, bottomRight, bottomLeft } = r.position;
    const { hex, escaped } = formatBytes(r.bytes);
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <h3>#${i + 1} — ${escapeHtml(r.format)}${
        r.symbologyIdentifier ? ` <span class="sym">${escapeHtml(r.symbologyIdentifier)}</span>` : ""
      }${r.readerInit ? ` <span class="badge">READER PROGRAMMING</span>` : ""}</h3>
      ${r.error ? `<p class="error">Error: ${escapeHtml(r.error)}</p>` : ""}
      <dl>
        <dt>Text</dt><dd><code>${escapeHtml(r.text)}</code></dd>
        <dt>Raw bytes (hex)</dt><dd><code>${hex}</code></dd>
        <dt>Raw bytes (escaped)</dt><dd><code>${escapeHtml(escaped)}</code></dd>
        <dt>Reader programming flag</dt><dd>${
          r.readerInit
            ? "yes — this symbol carries Code128 FNC3 / DataMatrix reader-init (e.g. Zebra <code>^PROG</code>), so it's a scanner command, not plain data"
            : "no"
        }</dd>
        <dt>EC level</dt><dd>${r.ecLevel || "—"}</dd>
        <dt>Position</dt><dd>${[topLeft, topRight, bottomRight, bottomLeft]
          .map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`)
          .join(" ")}</dd>
      </dl>
    `;
    container.appendChild(card);
  });
}
