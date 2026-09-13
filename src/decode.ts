import { prepareZXingModule, readBarcodes, type ReadResult } from "zxing-wasm/reader";
import zxingReaderWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// Self-host the wasm binary instead of the library's default (jsDelivr CDN)
// fetch, so decoding works fully offline once the page has loaded.
prepareZXingModule({
  overrides: {
    locateFile: (path) => (path.endsWith(".wasm") ? zxingReaderWasmUrl : path),
  },
});

const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const dropZone = document.querySelector<HTMLDivElement>("#drop-zone")!;
const previewWrap = document.querySelector<HTMLDivElement>("#preview-wrap")!;
const canvas = document.querySelector<HTMLCanvasElement>("#preview-canvas")!;
const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const resultsEl = document.querySelector<HTMLDivElement>("#results")!;

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

function formatBytes(bytes: Uint8Array): { hex: string; escaped: string } {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  const escaped = Array.from(bytes)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, "0")}`))
    .join("");
  return { hex, escaped };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleFile(file: File) {
  statusEl.textContent = "Decoding…";
  resultsEl.innerHTML = "";

  const bitmap = await createImageBitmap(file);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  previewWrap.hidden = false;

  let results: ReadResult[];
  try {
    results = await readBarcodes(file, {
      tryHarder: true,
      maxNumberOfSymbols: 32,
      returnErrors: true,
      textMode: "Escaped",
    });
  } catch (err) {
    statusEl.textContent = `Decode failed: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }

  if (results.length === 0) {
    statusEl.textContent = "No barcodes found.";
    return;
  }
  statusEl.textContent = `Found ${results.length} barcode${results.length === 1 ? "" : "s"}.`;

  ctx.lineWidth = Math.max(2, bitmap.width / 400);
  ctx.strokeStyle = "#ff5c00";
  ctx.fillStyle = "#ff5c00";
  ctx.font = `${Math.max(14, Math.round(bitmap.width / 60))}px monospace`;
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

    const { hex, escaped } = formatBytes(r.bytes);
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <h3>#${i + 1} — ${escapeHtml(r.format)}${
        r.symbologyIdentifier ? ` <span class="sym">${escapeHtml(r.symbologyIdentifier)}</span>` : ""
      }</h3>
      ${r.error ? `<p class="error">Error: ${escapeHtml(r.error)}</p>` : ""}
      <dl>
        <dt>Text</dt><dd><code>${escapeHtml(r.text)}</code></dd>
        <dt>Raw bytes (hex)</dt><dd><code>${hex}</code></dd>
        <dt>Raw bytes (escaped)</dt><dd><code>${escapeHtml(escaped)}</code></dd>
        <dt>EC level</dt><dd>${r.ecLevel || "—"}</dd>
        <dt>Position</dt><dd>${[topLeft, topRight, bottomRight, bottomLeft]
          .map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`)
          .join(" ")}</dd>
      </dl>
    `;
    resultsEl.appendChild(card);
  });
}
