import bwipjs from "bwip-js/browser";

const presetSelect = document.querySelector<HTMLSelectElement>("#preset")!;
const bcidSelect = document.querySelector<HTMLSelectElement>("#bcid")!;
const textInput = document.querySelector<HTMLTextAreaElement>("#text")!;
const optionsInput = document.querySelector<HTMLTextAreaElement>("#options")!;
const renderBtn = document.querySelector<HTMLButtonElement>("#render-btn")!;
const canvas = document.querySelector<HTMLCanvasElement>("#output-canvas")!;
const errorEl = document.querySelector<HTMLDivElement>("#error")!;
const downloadPngBtn = document.querySelector<HTMLButtonElement>("#download-png")!;
const downloadSvgBtn = document.querySelector<HTMLButtonElement>("#download-svg")!;

// Populate the symbology dropdown straight from BWIPP's own symbol table,
// so it never drifts out of sync with what the library actually supports.
for (const sym of bwipjs.symbolList) {
  const opt = document.createElement("option");
  opt.value = sym.bcid;
  opt.textContent = `${sym.bcid} — ${sym.desc}`;
  bcidSelect.appendChild(opt);
}

interface Preset {
  label: string;
  bcid: string;
  text: string;
  options: Record<string, unknown>;
}

const PRESETS: Preset[] = [
  { label: "QR Code — URL", bcid: "qrcode", text: "https://github.com", options: { eclevel: "M" } },
  { label: "Code 128", bcid: "code128", text: "HELLO-128", options: {} },
  {
    label: "Code 128 with FNC3 (device command)",
    bcid: "code128",
    text: "^FNC3HELLO",
    options: { parsefnc: true, showbearer: true },
  },
  {
    label: "Data Matrix",
    bcid: "datamatrix",
    text: "Hello Data Matrix!",
    options: { showbearer: true },
  },
  {
    label: "GS1-128 (AI 01 GTIN + AI 17 expiry)",
    bcid: "gs1-128",
    text: "(01)00012345678905(17)261231",
    options: {},
  },
];

for (const [i, preset] of PRESETS.entries()) {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = preset.label;
  presetSelect.appendChild(opt);
}

presetSelect.addEventListener("change", () => {
  if (!presetSelect.value) return;
  const preset = PRESETS[Number(presetSelect.value)];
  if (!preset) return;
  bcidSelect.value = preset.bcid;
  textInput.value = preset.text;
  optionsInput.value = JSON.stringify(preset.options, null, 2);
  render();
});

function readOptions(): Record<string, unknown> | undefined {
  try {
    return optionsInput.value.trim() ? JSON.parse(optionsInput.value) : {};
  } catch (err) {
    errorEl.textContent = `Options must be valid JSON: ${err instanceof Error ? err.message : String(err)}`;
    return undefined;
  }
}

function render() {
  errorEl.textContent = "";
  downloadPngBtn.disabled = true;
  downloadSvgBtn.disabled = true;

  const options = readOptions();
  if (options === undefined) return;

  try {
    // bwip-js/BWIPP options are a large, symbology-dependent grab bag (see the
    // BWIPP wiki) — passed straight through rather than modelled here.
    // backgroundcolor defaults to opaque white: bwip-js otherwise renders a
    // transparent background with black-RGB-but-alpha-0 pixels, which most
    // decoders (including zxing-wasm) read as solid black and fail to scan.
    bwipjs.toCanvas(canvas, {
      backgroundcolor: "FFFFFF",
      bcid: bcidSelect.value,
      text: textInput.value,
      ...options,
    } as Parameters<typeof bwipjs.toCanvas>[1]);
    downloadPngBtn.disabled = false;
    downloadSvgBtn.disabled = false;
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : String(err);
  }
}

let debounceHandle: ReturnType<typeof setTimeout> | undefined;
function renderDebounced() {
  clearTimeout(debounceHandle);
  debounceHandle = setTimeout(render, 350);
}

renderBtn.addEventListener("click", render);
bcidSelect.addEventListener("change", render);
textInput.addEventListener("input", renderDebounced);
optionsInput.addEventListener("input", renderDebounced);

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

downloadPngBtn.addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${bcidSelect.value}.png`);
  });
});

downloadSvgBtn.addEventListener("click", () => {
  const options = readOptions();
  if (options === undefined) return;
  try {
    const svg = bwipjs.toSVG({
      backgroundcolor: "FFFFFF",
      bcid: bcidSelect.value,
      text: textInput.value,
      ...options,
    } as Parameters<typeof bwipjs.toSVG>[0]);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${bcidSelect.value}.svg`);
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : String(err);
  }
});

// Initial state.
bcidSelect.value = "qrcode";
textInput.value = "https://github.com";
optionsInput.value = "{}";
render();
