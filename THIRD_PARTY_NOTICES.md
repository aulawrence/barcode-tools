# Third-party notices

This project's own code is MIT-licensed (see [LICENSE](LICENSE)). The
built site bundles and ships the compiled code of the runtime libraries
below directly to every visitor's browser (unlike a typical server-side
dependency, a client-side app *redistributes* these), so their licenses
are listed here rather than only in `package.json`/`node_modules`.

## Decode: zxing-wasm / zxing-cpp

- [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) — MIT License,
  Copyright (c) 2023 Ze-Zheng Wu. This is the JS/WASM wrapper this project
  imports.
- [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) — Apache License 2.0.
  The actual barcode-reading engine, compiled to WebAssembly and bundled by
  zxing-wasm.
- The `ZXingWasm.cpp` glue code in zxing-wasm — Apache License 2.0.
- [zint](https://sourceforge.net/projects/zint/) — BSD 3-Clause License.
  Bundled as part of zxing-wasm's compiled output; used for barcode
  *generation* in that library (this project only uses zxing-wasm's reader,
  but the shipped `.wasm` binary is built as one artifact).

## Generate: bwip-js / BWIPP

- [bwip-js](https://github.com/metafloor/bwip-js) — MIT License,
  Copyright (c) 2011-2026 Mark Warren. The JS port this project imports.
- [BWIPP](https://github.com/bwipp/postscriptbarcode) — MIT License,
  Copyright (c) 2004-2024 Terry Burton. The underlying PostScript barcode
  generator, transpiled to JS by bwip-js.

## PDF rendering: pdfjs-dist

- [pdf.js](https://github.com/mozilla/pdf.js) — Apache License 2.0,
  Mozilla Foundation. Used to render PDF pages to a canvas for decoding
  and for the "Annotate whole PDF" export.

## PDF generation: pdf-lib

- [pdf-lib](https://github.com/Hopding/pdf-lib) — MIT License,
  Copyright (c) 2019 Andrew Dillon. Used to draw annotation boxes/labels
  onto a copy of the original PDF.

## Build-time only (not bundled into the shipped site)

Vite, TypeScript, and `@vitejs/plugin-basic-ssl` are development tooling
only — none of their code ships to visitors. See their own repositories
for license details if relevant.
