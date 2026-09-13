import bwipjs from "bwip-js/browser";
import { GENERIC_FIELD_GROUPS, SYMBOLOGY_FIELDS, type FieldGroup, type FieldSpec } from "./symbology-options";
import { categorizeSymbology, GROUP_ORDER } from "./symbology-groups";

const presetSelect = document.querySelector<HTMLSelectElement>("#preset")!;
const bcidSearchInput = document.querySelector<HTMLInputElement>("#bcid-search")!;
const bcidDropdown = document.querySelector<HTMLDivElement>("#bcid-dropdown")!;
const textInput = document.querySelector<HTMLTextAreaElement>("#text")!;
const symbologyFieldsWrap = document.querySelector<HTMLDivElement>("#symbology-fields-wrap")!;
const symbologyFieldsTitle = document.querySelector<HTMLHeadingElement>("#symbology-fields-title")!;
const symbologyFieldsEl = document.querySelector<HTMLDivElement>("#symbology-fields")!;
const genericFieldsEl = document.querySelector<HTMLDivElement>("#generic-fields")!;
const derivedOptionsEl = document.querySelector<HTMLTextAreaElement>("#derived-options")!;
const optionsInput = document.querySelector<HTMLTextAreaElement>("#options")!;
const renderBtn = document.querySelector<HTMLButtonElement>("#render-btn")!;
const canvas = document.querySelector<HTMLCanvasElement>("#output-canvas")!;
const errorEl = document.querySelector<HTMLDivElement>("#error")!;
const downloadPngBtn = document.querySelector<HTMLButtonElement>("#download-png")!;
const downloadSvgBtn = document.querySelector<HTMLButtonElement>("#download-svg")!;

// --- symbology picker: searchable, grouped combobox ------------------------
// Built from bwip-js's own symbol table, so it never drifts out of sync
// with what the library actually supports (100+ entries — a flat <select>
// was unusable, hence search + grouping instead of a plain dropdown).

interface SymEntry {
  bcid: string;
  desc: string;
  group: string;
}

const ALL_SYMBOLS: SymEntry[] = bwipjs.symbolList
  .map((s) => ({ bcid: s.bcid, desc: s.desc, group: categorizeSymbology(s.bcid) }))
  .sort((a, b) => a.bcid.localeCompare(b.bcid));

let currentBcid = "qrcode";
let activeOptionIndex = -1;

function getBcid(): string {
  return currentBcid;
}

function symbolLabel(entry: SymEntry): string {
  return `${entry.bcid} — ${entry.desc}`;
}

function currentBcidLabel(): string {
  const entry = ALL_SYMBOLS.find((s) => s.bcid === currentBcid);
  return entry ? symbolLabel(entry) : currentBcid;
}

function matchesQuery(entry: SymEntry, query: string): boolean {
  const q = query.toLowerCase();
  return entry.bcid.toLowerCase().includes(q) || entry.desc.toLowerCase().includes(q);
}

function renderBcidDropdown(query: string) {
  const q = query.trim();
  const filtered = q ? ALL_SYMBOLS.filter((s) => matchesQuery(s, q)) : ALL_SYMBOLS;
  activeOptionIndex = -1;
  bcidDropdown.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "combobox-empty";
    empty.textContent = "No matching symbology.";
    bcidDropdown.appendChild(empty);
    return;
  }

  for (const group of GROUP_ORDER) {
    const items = filtered.filter((s) => s.group === group);
    if (items.length === 0) continue;
    const header = document.createElement("div");
    header.className = "combobox-group";
    header.textContent = group;
    bcidDropdown.appendChild(header);
    for (const entry of items) {
      const opt = document.createElement("div");
      opt.className = "combobox-option";
      opt.role = "option";
      opt.textContent = symbolLabel(entry);
      opt.dataset.bcid = entry.bcid;
      // mousedown (not click) fires before the input's blur closes the dropdown.
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        setBcid(entry.bcid);
      });
      bcidDropdown.appendChild(opt);
    }
  }
}

function openBcidDropdown() {
  renderBcidDropdown(bcidSearchInput.value === currentBcidLabel() ? "" : bcidSearchInput.value);
  bcidDropdown.hidden = false;
  bcidSearchInput.setAttribute("aria-expanded", "true");
}

function closeBcidDropdown() {
  bcidDropdown.hidden = true;
  activeOptionIndex = -1;
  bcidSearchInput.setAttribute("aria-expanded", "false");
}

function highlightOption(options: HTMLElement[]) {
  options.forEach((o, i) => o.classList.toggle("active", i === activeOptionIndex));
  options[activeOptionIndex]?.scrollIntoView({ block: "nearest" });
}

function setBcid(bcid: string, opts: { fireChange?: boolean } = {}) {
  currentBcid = bcid;
  bcidSearchInput.value = currentBcidLabel();
  closeBcidDropdown();
  if (opts.fireChange !== false) {
    updateSymbologyFields();
    render();
  }
}

bcidSearchInput.addEventListener("focus", () => {
  bcidSearchInput.select();
  openBcidDropdown();
});
bcidSearchInput.addEventListener("input", () => {
  renderBcidDropdown(bcidSearchInput.value);
  bcidDropdown.hidden = false;
});
bcidSearchInput.addEventListener("blur", () => {
  // Deferred so a mousedown on an option (above) runs first.
  window.setTimeout(() => {
    bcidSearchInput.value = currentBcidLabel();
    closeBcidDropdown();
  }, 0);
});
bcidSearchInput.addEventListener("keydown", (e) => {
  if (bcidDropdown.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    openBcidDropdown();
    return;
  }
  const options = Array.from(bcidDropdown.querySelectorAll<HTMLElement>(".combobox-option"));
  if (options.length === 0) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeOptionIndex = Math.min(activeOptionIndex + 1, options.length - 1);
    highlightOption(options);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeOptionIndex = Math.max(activeOptionIndex - 1, 0);
    highlightOption(options);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const target = options[activeOptionIndex >= 0 ? activeOptionIndex : 0];
    if (target?.dataset.bcid) setBcid(target.dataset.bcid);
  } else if (e.key === "Escape") {
    bcidSearchInput.value = currentBcidLabel();
    closeBcidDropdown();
  }
});

// --- typed field rendering ---------------------------------------------

function fieldId(name: string): string {
  return `field-${name}`;
}

function createFieldElement(field: FieldSpec): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `field field-${field.kind}`;
  const id = fieldId(field.name);
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = field.label;

  let control: HTMLInputElement | HTMLSelectElement;
  if (field.kind === "boolean") {
    control = document.createElement("input");
    control.type = "checkbox";
  } else if (field.kind === "select") {
    control = document.createElement("select");
    for (const choice of field.choices) {
      const opt = document.createElement("option");
      opt.value = choice.value;
      opt.textContent = choice.label;
      control.appendChild(opt);
    }
  } else {
    control = document.createElement("input");
    control.type = field.kind === "number" ? "number" : "text";
    if (field.kind === "number") {
      if (field.min !== undefined) control.min = String(field.min);
      if (field.max !== undefined) control.max = String(field.max);
      if (field.step !== undefined) control.step = String(field.step);
    } else if (field.placeholder) {
      control.placeholder = field.placeholder;
    }
  }
  control.id = id;
  control.dataset.field = field.name;
  control.dataset.kind = field.kind;

  if (field.kind === "boolean") {
    wrap.append(control, label);
  } else {
    wrap.append(label, control);
  }
  if (field.hint) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = field.hint;
    wrap.appendChild(hint);
  }
  return wrap;
}

function renderFieldGroups(container: HTMLElement, groups: FieldGroup[]) {
  container.innerHTML = "";
  for (const group of groups) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = group.title;
    fieldset.appendChild(legend);
    const grid = document.createElement("div");
    grid.className = "field-grid";
    for (const field of group.fields) grid.appendChild(createFieldElement(field));
    fieldset.appendChild(grid);
    container.appendChild(fieldset);
  }
}

function renderFields(container: HTMLElement, fields: FieldSpec[]) {
  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "field-grid";
  for (const field of fields) grid.appendChild(createFieldElement(field));
  container.appendChild(grid);
}

function collectFieldValues(container: HTMLElement): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]").forEach((el) => {
    const name = el.dataset.field!;
    const kind = el.dataset.kind!;
    if (kind === "boolean") {
      if ((el as HTMLInputElement).checked) result[name] = true;
    } else if (kind === "number") {
      const n = Number(el.value);
      if (el.value !== "" && !Number.isNaN(n)) result[name] = n;
    } else if (el.value !== "") {
      result[name] = el.value;
    }
  });
  return result;
}

function resetFieldValues(container: HTMLElement) {
  container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]").forEach((el) => {
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      el.checked = false;
    } else {
      el.value = "";
    }
  });
}

renderFieldGroups(genericFieldsEl, GENERIC_FIELD_GROUPS);
genericFieldsEl.addEventListener("input", () => renderDebounced());
genericFieldsEl.addEventListener("change", () => renderDebounced());

function updateSymbologyFields() {
  const fields = SYMBOLOGY_FIELDS[getBcid()];
  if (fields && fields.length > 0) {
    symbologyFieldsTitle.textContent = `"${getBcid()}" settings`;
    renderFields(symbologyFieldsEl, fields);
    symbologyFieldsWrap.hidden = false;
  } else {
    symbologyFieldsEl.innerHTML = "";
    symbologyFieldsWrap.hidden = true;
  }
}

symbologyFieldsEl.addEventListener("input", () => renderDebounced());
symbologyFieldsEl.addEventListener("change", () => renderDebounced());

// --- presets -------------------------------------------------------------

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
    options: { parsefnc: true },
  },
  { label: "Data Matrix", bcid: "datamatrix", text: "Hello Data Matrix!", options: {} },
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
  setBcid(preset.bcid, { fireChange: false });
  updateSymbologyFields();
  resetFieldValues(genericFieldsEl);
  resetFieldValues(symbologyFieldsEl);
  textInput.value = preset.text;
  optionsInput.value = JSON.stringify(preset.options, null, 2);
  render();
});

// --- render ----------------------------------------------------------------

function readJsonOptions(): Record<string, unknown> | undefined {
  try {
    return optionsInput.value.trim() ? JSON.parse(optionsInput.value) : {};
  } catch (err) {
    errorEl.textContent = `Options must be valid JSON: ${err instanceof Error ? err.message : String(err)}`;
    return undefined;
  }
}

function typedFieldValues(): Record<string, unknown> {
  return {
    ...collectFieldValues(genericFieldsEl),
    ...collectFieldValues(symbologyFieldsEl),
  };
}

function updateDerivedOptionsPreview() {
  derivedOptionsEl.value = JSON.stringify(typedFieldValues(), null, 2);
}

function buildOptions(): (Record<string, unknown> & { bcid: string; text: string }) | undefined {
  const jsonOptions = readJsonOptions();
  if (jsonOptions === undefined) return undefined;
  return {
    // bwip-js otherwise renders a transparent background with black-RGB-
    // but-alpha-0 pixels, which most decoders (including zxing-wasm) read
    // as solid black and fail to scan.
    backgroundcolor: "FFFFFF",
    bcid: getBcid(),
    text: textInput.value,
    ...typedFieldValues(),
    ...jsonOptions,
  };
}

function render() {
  errorEl.textContent = "";
  downloadPngBtn.disabled = true;
  downloadSvgBtn.disabled = true;
  updateDerivedOptionsPreview();

  const options = buildOptions();
  if (options === undefined) return;

  try {
    bwipjs.toCanvas(canvas, options as Parameters<typeof bwipjs.toCanvas>[1]);
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
    if (blob) downloadBlob(blob, `${getBcid()}.png`);
  });
});

downloadSvgBtn.addEventListener("click", () => {
  const options = buildOptions();
  if (options === undefined) return;
  try {
    const svg = bwipjs.toSVG(options as Parameters<typeof bwipjs.toSVG>[0]);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${getBcid()}.svg`);
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : String(err);
  }
});

// Initial state.
setBcid("qrcode", { fireChange: false });
textInput.value = "https://github.com";
optionsInput.value = "{}";
updateSymbologyFields();
render();
