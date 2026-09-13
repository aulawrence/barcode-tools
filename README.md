# Barcode Tools

Two small barcode utilities, both running entirely client-side (no server,
nothing uploaded anywhere), deployable as a static site to GitHub Pages.

- **Decode** (`decode.html`) — upload an image, decode every barcode on it
  via a WebAssembly build of [`zxing-cpp`](https://github.com/zxing-cpp/zxing-cpp)
  ([`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm)). Shows the raw
  decoded bytes (hex + escaped) as well as the library's own escaped text
  rendering, so non-printable payload bytes (GS1 separators, etc.) are
  visible rather than silently dropped.
- **Generate** (`generate.html`) — a thin wrapper around
  [BWIPP](https://github.com/bwipp/postscriptbarcode/wiki) via
  [`bwip-js`](https://github.com/metafloor/bwip-js). Pick a symbology (the
  list is pulled straight from `bwip-js`'s own symbol table), type the data,
  and pass any BWIPP option as raw JSON — the same option names as the BWIPP
  wiki (`parsefnc`, `eclevel`, `version`, etc.).

## Known limitation: which FNC value, on decode

`zxing-cpp` decodes Code128 FNC1 into a GS1 separator (shown in the escaped
text), and exposes Code128 FNC3 / DataMatrix reader-programming symbols
(e.g. Zebra's `^PROG` scanner-config barcodes) via a `readerInit` flag,
shown as a "READER PROGRAMMING" badge on the Decode page. What it does
*not* expose is which specific FNC value (2, 3, or 4) triggered that flag,
or FNC2/FNC4 as distinct markers at all — they're consumed during decoding
rather than left in `text`/`bytes`. A dedicated decoder (e.g. `pylibdmtx`,
used in a companion Python project) can distinguish these at a lower level,
but has no WebAssembly build, so this browser tool can't currently surface
that distinction. The payload itself always decodes correctly either way.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
```

## Deployment

Pushing to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml),
which builds the site and publishes `dist/` to GitHub Pages. Enable Pages for
this repo once, with source set to "GitHub Actions" (Settings → Pages).

## Reference

- [BWIPP Wiki](https://github.com/bwipp/postscriptbarcode/wiki) — symbology
  options reference for the Generate page.
- [zxing-cpp supported formats](https://github.com/zxing-cpp/zxing-cpp#supported-formats)
