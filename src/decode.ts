import { decodeImage, drawOverlay, renderResultCards, type ReadResult } from "./barcode-reader";
import { annotatePdf, openPdf, renderAndDecodePage, type PdfSession } from "./pdf-tools";
import { closeVideo, openVideo, scanForward, seekToFrame, type VideoSession } from "./video-tools";

const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const dropZone = document.querySelector<HTMLDivElement>("#drop-zone")!;
const previewWrap = document.querySelector<HTMLDivElement>("#preview-wrap")!;
const canvas = document.querySelector<HTMLCanvasElement>("#preview-canvas")!;
const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const resultsEl = document.querySelector<HTMLDivElement>("#results")!;
const interruptBtn = document.querySelector<HTMLButtonElement>("#interrupt-btn")!;
const videoEl = document.querySelector<HTMLVideoElement>("#video-source")!;

const pdfControls = document.querySelector<HTMLDivElement>("#pdf-controls")!;
const pdfPrevBtn = document.querySelector<HTMLButtonElement>("#pdf-prev")!;
const pdfNextBtn = document.querySelector<HTMLButtonElement>("#pdf-next")!;
const pdfPageInput = document.querySelector<HTMLInputElement>("#pdf-page-input")!;
const pdfPageLabel = document.querySelector<HTMLParagraphElement>("#pdf-page-label")!;
const pdfAnnotateBtn = document.querySelector<HTMLButtonElement>("#pdf-annotate-btn")!;
const pdfAnnotateStatus = document.querySelector<HTMLParagraphElement>("#pdf-annotate-status")!;

const videoControls = document.querySelector<HTMLDivElement>("#video-controls")!;
const videoScanBtn = document.querySelector<HTMLButtonElement>("#video-scan-btn")!;
const videoRestartBtn = document.querySelector<HTMLButtonElement>("#video-restart-btn")!;
const videoFrameInput = document.querySelector<HTMLInputElement>("#video-frame-input")!;
const videoFrameGoBtn = document.querySelector<HTMLButtonElement>("#video-frame-go")!;
const videoFrameLabel = document.querySelector<HTMLParagraphElement>("#video-frame-label")!;

type Mode = "image" | "pdf" | "video";

let pdfSession: PdfSession | null = null;
let videoSession: VideoSession | null = null;
let activeAbort: AbortController | null = null;
let busy = false;

// --- file intake -----------------------------------------------------------

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

function detectMode(file: File): Mode {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi|mkv)$/.test(name)) return "video";
  return "image";
}

function resetModeUI() {
  pdfControls.hidden = true;
  videoControls.hidden = true;
  interruptBtn.hidden = true;
  pdfAnnotateStatus.textContent = "";
  videoFrameLabel.textContent = "";
  resultsEl.innerHTML = "";
  pdfSession = null;
  if (videoSession) {
    closeVideo(videoSession);
    videoSession = null;
  }
  activeAbort?.abort();
  activeAbort = null;
}

async function handleFile(file: File) {
  resetModeUI();
  const mode = detectMode(file);

  if (mode === "pdf") return void handlePdfFile(file);
  if (mode === "video") return void handleVideoFile(file);
  return void handleImageFile(file);
}

// --- image mode --------------------------------------------------------

async function handleImageFile(file: File) {
  statusEl.textContent = "Decoding…";

  const bitmap = await createImageBitmap(file);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  previewWrap.hidden = false;

  try {
    const results = await decodeImage(file);
    reportResults(results, canvas.width, ctx);
  } catch (err) {
    statusEl.textContent = `Decode failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function reportResults(results: ReadResult[], width: number, ctx: CanvasRenderingContext2D) {
  if (results.length === 0) {
    statusEl.textContent = "No barcodes found.";
    return;
  }
  statusEl.textContent = `Found ${results.length} barcode${results.length === 1 ? "" : "s"}.`;
  drawOverlay(ctx, width, results);
  renderResultCards(resultsEl, results);
}

// --- pdf mode ------------------------------------------------------------

async function handlePdfFile(file: File) {
  statusEl.textContent = "Loading PDF…";
  try {
    pdfSession = await openPdf(file);
  } catch (err) {
    statusEl.textContent = `Could not open PDF: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  pdfControls.hidden = false;
  pdfPageInput.max = String(pdfSession.numPages);
  previewWrap.hidden = false;
  await goToPdfPage(1);
}

async function goToPdfPage(pageNum: number) {
  if (!pdfSession) return;
  pageNum = Math.min(Math.max(pageNum, 1), pdfSession.numPages);
  pdfPageInput.value = String(pageNum);
  pdfPageLabel.textContent = `Page ${pageNum} of ${pdfSession.numPages}`;
  statusEl.textContent = "Rendering page…";
  resultsEl.innerHTML = "";

  const results = await renderAndDecodePage(pdfSession, pageNum, canvas);
  statusEl.textContent =
    results.length === 0
      ? "No barcodes found on this page."
      : `Found ${results.length} barcode${results.length === 1 ? "" : "s"} on this page.`;
  renderResultCards(resultsEl, results);
}

pdfPrevBtn.addEventListener("click", () => void goToPdfPage(Number(pdfPageInput.value) - 1));
pdfNextBtn.addEventListener("click", () => void goToPdfPage(Number(pdfPageInput.value) + 1));
pdfPageInput.addEventListener("change", () => void goToPdfPage(Number(pdfPageInput.value) || 1));

pdfAnnotateBtn.addEventListener("click", async () => {
  if (!pdfSession || busy) return;
  busy = true;
  pdfAnnotateBtn.disabled = true;
  interruptBtn.hidden = false;
  const abort = new AbortController();
  activeAbort = abort;

  try {
    const result = await annotatePdf(
      pdfSession,
      ({ page, totalPages, foundSoFar }) => {
        pdfAnnotateStatus.textContent = `Scanning page ${page} of ${totalPages} — ${foundSoFar} barcode${
          foundSoFar === 1 ? "" : "s"
        } found so far…`;
      },
      abort.signal,
    );

    if (result === "aborted") {
      pdfAnnotateStatus.textContent = "Interrupted.";
    } else {
      downloadBlob(new Blob([result.buffer as ArrayBuffer], { type: "application/pdf" }), annotatedFilename());
      pdfAnnotateStatus.textContent = "Done — annotated PDF downloaded.";
    }
  } catch (err) {
    pdfAnnotateStatus.textContent = `Failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    busy = false;
    pdfAnnotateBtn.disabled = false;
    interruptBtn.hidden = true;
    activeAbort = null;
  }
});

function annotatedFilename(): string {
  const name = fileInput.files?.[0]?.name ?? "document.pdf";
  return name.replace(/\.pdf$/i, "") + "_annotated.pdf";
}

// --- video mode ----------------------------------------------------------

async function handleVideoFile(file: File) {
  statusEl.textContent = "Loading video…";
  try {
    videoSession = await openVideo(videoEl, file);
  } catch (err) {
    statusEl.textContent = `Could not open video: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  videoControls.hidden = false;
  videoScanBtn.textContent = "Find first barcode";
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext("2d")!.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  previewWrap.hidden = false;
  statusEl.textContent = `Video loaded (${videoEl.duration.toFixed(1)}s). Click "Find first barcode" or skip to a frame.`;
  if (!videoSession.usesFrameCallback) {
    statusEl.textContent +=
      " Note: this browser doesn't support per-frame stepping, so scanning samples ~10 times/sec instead of true frames.";
  }
}

let foundOnceInVideo = false;

videoScanBtn.addEventListener("click", async () => {
  if (!videoSession || busy) return;
  busy = true;
  setVideoControlsDisabled(true);
  interruptBtn.hidden = false;
  const abort = new AbortController();
  activeAbort = abort;
  statusEl.textContent = "Scanning…";

  try {
    const outcome = await scanForward(videoSession, canvas, abort.signal, ({ frameIndex, timeSeconds }) => {
      videoFrameLabel.textContent = `Scanning… frame ${frameIndex} (t=${timeSeconds.toFixed(2)}s)`;
    });

    videoFrameInput.value = String(outcome.frame.frameIndex);
    videoFrameLabel.textContent = `Frame ${outcome.frame.frameIndex} (t=${outcome.frame.timeSeconds.toFixed(2)}s)`;

    if (outcome.status === "found") {
      foundOnceInVideo = true;
      videoScanBtn.textContent = "Find next match";
      statusEl.textContent = `Found ${outcome.results.length} barcode${outcome.results.length === 1 ? "" : "s"} at frame ${outcome.frame.frameIndex}.`;
      renderResultCards(resultsEl, outcome.results);
    } else if (outcome.status === "ended") {
      statusEl.textContent = foundOnceInVideo
        ? "Reached end of video — no more barcodes found."
        : "Reached end of video — no barcodes found.";
    } else {
      statusEl.textContent = `Interrupted at frame ${outcome.frame.frameIndex} (t=${outcome.frame.timeSeconds.toFixed(2)}s).`;
    }
  } finally {
    busy = false;
    setVideoControlsDisabled(false);
    interruptBtn.hidden = true;
    activeAbort = null;
  }
});

videoRestartBtn.addEventListener("click", () => {
  if (!videoSession || busy) return;
  videoEl.pause();
  videoEl.currentTime = 0;
  foundOnceInVideo = false;
  videoScanBtn.textContent = "Find first barcode";
  videoFrameInput.value = "0";
  videoFrameLabel.textContent = "";
  resultsEl.innerHTML = "";
  statusEl.textContent = "Rewound to the start.";
  canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  canvas.getContext("2d")!.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
});

videoFrameGoBtn.addEventListener("click", async () => {
  if (!videoSession || busy) return;
  busy = true;
  setVideoControlsDisabled(true);
  statusEl.textContent = "Seeking…";

  try {
    const target = Math.max(0, Math.round(Number(videoFrameInput.value) || 0));
    const { frame, results } = await seekToFrame(videoSession, canvas, target);
    videoFrameLabel.textContent = `Frame ${frame.frameIndex} (t=${frame.timeSeconds.toFixed(2)}s, approximate)`;
    statusEl.textContent =
      results.length === 0
        ? "No barcode found on this frame."
        : `Found ${results.length} barcode${results.length === 1 ? "" : "s"} on this frame.`;
    renderResultCards(resultsEl, results);
  } finally {
    busy = false;
    setVideoControlsDisabled(false);
  }
});

function setVideoControlsDisabled(disabled: boolean) {
  videoScanBtn.disabled = disabled;
  videoRestartBtn.disabled = disabled;
  videoFrameInput.disabled = disabled;
  videoFrameGoBtn.disabled = disabled;
}

// --- interrupt -------------------------------------------------------------

interruptBtn.addEventListener("click", () => activeAbort?.abort());

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
