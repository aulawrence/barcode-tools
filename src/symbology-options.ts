// Option schemas for building typed form controls on the Generate page,
// instead of requiring hand-written JSON for everything.
//
// GENERIC_FIELD_GROUPS is sourced from bwip-js's own shipped type
// definitions (dist/bwip-js.d.ts: BwippOptions/RenderOptions), which cover
// almost every symbology.
//
// Note: `showbearer` (the thick border used on scanner reader-programming
// barcodes) is referenced by BWIPP's own PostScript rendering code, but is
// NOT forwarded by bwip-js's JS layer — verified empirically (identical
// output bytes with/without it). It only works through treepoem's more
// permissive raw-option passthrough to Ghostscript, so it's deliberately
// left out here rather than shown as a control that silently does nothing.
//
// SYMBOLOGY_FIELDS covers the handful of symbologies with substantial
// symbology-specific options (2D matrix/stacked codes) — each entry was
// read directly out of barcode.ps's option declarations for that encoder,
// not guessed, since getting e.g. Data Matrix's valid version strings
// wrong would silently produce broken barcodes. Everything else relies on
// the generic fields plus the raw JSON "Advanced" override.

export type FieldSpec =
  | { name: string; label: string; kind: "boolean"; hint?: string }
  | { name: string; label: string; kind: "select"; choices: { value: string; label: string }[]; hint?: string }
  | { name: string; label: string; kind: "number"; min?: number; max?: number; step?: number; hint?: string }
  | { name: string; label: string; kind: "text"; placeholder?: string; hint?: string };

export interface FieldGroup {
  title: string;
  fields: FieldSpec[];
}

export const GENERIC_FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Text",
    fields: [
      { name: "includetext", label: "Show human-readable text", kind: "boolean" },
      {
        name: "textfont",
        label: "Text font",
        kind: "text",
        placeholder: "default: OCR-B",
        hint: "Leave blank to use BWIPP's default (OCR-B for most symbologies)",
      },
      {
        name: "textsize",
        label: "Text size",
        kind: "number",
        min: 1,
        step: 1,
        hint: "Leave blank to use BWIPP's default (typically 10-12pt, varies by symbology)",
      },
      { name: "textgaps", label: "Text character gaps", kind: "number", step: 0.1 },
      {
        name: "textxalign",
        label: "Text horizontal align",
        kind: "select",
        choices: [
          { value: "", label: "(default — usually center)" },
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
          { value: "offleft", label: "Off left" },
          { value: "offright", label: "Off right" },
          { value: "justify", label: "Justify" },
        ],
      },
      {
        name: "textyalign",
        label: "Text vertical align",
        kind: "select",
        choices: [
          { value: "", label: "(default — usually below)" },
          { value: "below", label: "Below" },
          { value: "center", label: "Center" },
          { value: "above", label: "Above" },
        ],
      },
      { name: "textxoffset", label: "Text X offset", kind: "number", step: 1 },
      { name: "textyoffset", label: "Text Y offset", kind: "number", step: 1 },
      { name: "alttext", label: "Alt text (overrides displayed text only, not the encoded data)", kind: "text" },
    ],
  },
  {
    title: "Size & orientation",
    fields: [
      { name: "scale", label: "Scale", kind: "number", min: 1, step: 1 },
      { name: "scaleX", label: "Scale X", kind: "number", min: 1, step: 1 },
      { name: "scaleY", label: "Scale Y", kind: "number", min: 1, step: 1 },
      { name: "height", label: "Height (mm)", kind: "number", min: 0.1, step: 0.1 },
      { name: "width", label: "Width (mm)", kind: "number", min: 0.1, step: 0.1 },
      {
        name: "rotate",
        label: "Rotate",
        kind: "select",
        choices: [
          { value: "", label: "(default)" },
          { value: "N", label: "None" },
          { value: "R", label: "90° right" },
          { value: "L", label: "90° left" },
          { value: "I", label: "180°" },
        ],
      },
    ],
  },
  {
    title: "Border",
    fields: [
      { name: "showborder", label: "Show border", kind: "boolean" },
      { name: "borderwidth", label: "Border width", kind: "number", min: 0, step: 1 },
      { name: "borderleft", label: "Border left", kind: "number", step: 1 },
      { name: "borderright", label: "Border right", kind: "number", step: 1 },
      { name: "bordertop", label: "Border top", kind: "number", step: 1 },
      { name: "borderbottom", label: "Border bottom", kind: "number", step: 1 },
    ],
  },
  {
    title: "Colors",
    fields: [
      { name: "barcolor", label: "Bar color", kind: "text", placeholder: "e.g. 000000" },
      { name: "backgroundcolor", label: "Background color", kind: "text", placeholder: "e.g. FFFFFF" },
      { name: "bordercolor", label: "Border color", kind: "text", placeholder: "e.g. 000000" },
      { name: "textcolor", label: "Text color", kind: "text", placeholder: "e.g. 000000" },
    ],
  },
  {
    title: "Padding",
    fields: [
      { name: "padding", label: "Padding (all sides)", kind: "number", min: 0, step: 1 },
      { name: "paddingwidth", label: "Padding width", kind: "number", min: 0, step: 1 },
      { name: "paddingheight", label: "Padding height", kind: "number", min: 0, step: 1 },
      { name: "paddingleft", label: "Padding left", kind: "number", step: 1 },
      { name: "paddingright", label: "Padding right", kind: "number", step: 1 },
      { name: "paddingtop", label: "Padding top", kind: "number", step: 1 },
      { name: "paddingbottom", label: "Padding bottom", kind: "number", step: 1 },
    ],
  },
  {
    title: "Advanced rendering",
    fields: [
      { name: "parse", label: "Parse backslash escapes (\\xHH, \\d..., ^...)", kind: "boolean" },
      { name: "parsefnc", label: "Parse ^FNC1 / ^FNC2 / ^FNC3 / ^FNC4", kind: "boolean" },
      { name: "monochrome", label: "Monochrome output", kind: "boolean" },
      { name: "dotty", label: "Dotty mode (dots instead of solid bars/modules)", kind: "boolean" },
      { name: "inkspread", label: "Ink spread", kind: "number", step: 0.1 },
      { name: "includecheck", label: "Include check digit/character", kind: "boolean" },
      { name: "includecheckintext", label: "Include check digit/character in text", kind: "boolean" },
      { name: "guardwhitespace", label: "Show EAN/UPC guard whitespace indicators", kind: "boolean" },
    ],
  },
];

const QR_FIELDS: FieldSpec[] = [
  {
    name: "format",
    label: "Format",
    kind: "select",
    choices: [
      { value: "", label: "(auto)" },
      { value: "full", label: "Full QR Code" },
      { value: "micro", label: "Micro QR Code" },
      { value: "rmqr", label: "rMQR (requires a version below)" },
    ],
  },
  {
    name: "version",
    label: "Version",
    kind: "text",
    placeholder: "e.g. 1-40, M1-M4, or R7x43",
    hint: "Leave blank for automatic sizing",
  },
  {
    name: "eclevel",
    label: "Error correction level",
    kind: "select",
    choices: [
      { value: "", label: "(auto)" },
      { value: "L", label: "L (Micro QR / rMQR: not valid)" },
      { value: "M", label: "M" },
      { value: "Q", label: "Q (rMQR: not valid)" },
      { value: "H", label: "H (Micro QR: not valid)" },
    ],
    hint: "Full QR: L/M/Q/H. Micro QR: L/M/Q. rMQR: M/H.",
  },
  { name: "mask", label: "Mask pattern", kind: "number", min: -1, max: 7, step: 1, hint: "-1 = automatic" },
];

const DATAMATRIX_VERSIONS: { value: string; label: string }[] = [
  { value: "", label: "(auto)" },
  ...["10x10", "12x12", "14x14", "16x16", "18x18", "20x20", "22x22", "24x24", "26x26", "32x32", "36x36", "40x40",
      "44x44", "48x48", "52x52", "64x64", "72x72", "80x80", "88x88", "96x96", "104x104", "120x120", "132x132", "144x144"]
    .map((v) => ({ value: v, label: `${v} (square)` })),
  ...["8x18", "8x32", "8x48", "8x64", "8x80", "8x96", "8x120", "8x144", "12x26", "12x36", "12x64", "12x88",
      "16x36", "16x48", "16x64", "20x36", "20x44", "20x64", "22x48", "24x48", "24x64", "26x40", "26x48", "26x64"]
    .map((v) => ({ value: v, label: `${v} (rectangular)` })),
];

const AZTEC_FIELDS: FieldSpec[] = [
  {
    name: "format",
    label: "Format",
    kind: "select",
    choices: [
      { value: "full", label: "Full" },
      { value: "compact", label: "Compact" },
      { value: "rune", label: "Rune (no data, layers/readerinit not valid)" },
    ],
  },
  {
    name: "layers",
    label: "Layers",
    kind: "number",
    min: -1,
    max: 32,
    step: 1,
    hint: "-1 = auto. Compact: 1-4 (must be 1 if reader-init). Full: 1-32 (1-22 if reader-init).",
  },
  {
    name: "eclevel",
    label: "Error correction (%)",
    kind: "number",
    min: 5,
    max: 95,
    step: 1,
    hint: "Minimum percentage of codewords reserved for error correction (default 23)",
  },
  { name: "readerinit", label: "Reader-programming symbol", kind: "boolean" },
];

export const SYMBOLOGY_FIELDS: Record<string, FieldSpec[]> = {
  qrcode: QR_FIELDS,
  microqrcode: QR_FIELDS,
  datamatrix: [
    {
      name: "format",
      label: "Format",
      kind: "select",
      choices: [
        { value: "", label: "(auto)" },
        { value: "square", label: "Square" },
        { value: "rectangle", label: "Rectangle" },
      ],
    },
    { name: "version", label: "Version (size)", kind: "select", choices: DATAMATRIX_VERSIONS },
    { name: "dmre", label: "Prefer DMRE sizes when auto-sizing", kind: "boolean" },
  ],
  azteccode: AZTEC_FIELDS,
  pdf417: [
    { name: "compact", label: "Compact (truncated) PDF417", kind: "boolean" },
    { name: "columns", label: "Columns", kind: "number", min: 0, max: 30, step: 1, hint: "0 = auto (1-30)" },
    { name: "rows", label: "Rows", kind: "number", min: 0, max: 90, step: 1, hint: "0 = auto (3-90)" },
    {
      name: "eclevel",
      label: "Error correction level",
      kind: "number",
      min: -1,
      max: 8,
      step: 1,
      hint: "-1 = auto (0-8; higher = more error correction, fewer data codewords)",
    },
  ],
  micropdf417: [
    {
      name: "version",
      label: "Version (rows x columns)",
      kind: "text",
      placeholder: "e.g. 8x2",
      hint: "Must match one of MicroPDF417's defined row/column combinations (see the BWIPP wiki) — leave blank for auto",
    },
    { name: "columns", label: "Columns", kind: "number", min: 0, step: 1, hint: "0 = auto" },
    { name: "rows", label: "Rows", kind: "number", min: 0, step: 1, hint: "0 = auto" },
    { name: "cca", label: "Composite Component A linkage", kind: "boolean" },
    { name: "ccb", label: "Composite Component B linkage", kind: "boolean" },
  ],
  maxicode: [
    {
      name: "mode",
      label: "Mode",
      kind: "select",
      choices: [
        { value: "", label: "(auto)" },
        { value: "2", label: "2 — US-style postcode" },
        { value: "3", label: "3 — International postcode" },
        { value: "4", label: "4 — Standard" },
        { value: "5", label: "5 — Full EEC (no postcode)" },
        { value: "6", label: "6 — Reader programming" },
      ],
      hint: "Modes 2/3 expect the message formatted as postcode+GS+countrycode+GS+service+GS+... — see the BWIPP wiki",
    },
  ],
};
