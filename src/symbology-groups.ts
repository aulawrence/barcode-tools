// Cosmetic grouping for the symbology picker only — not part of BWIPP's own
// data (bwip-js's symbolList has no family/category field), so this is a
// simple, low-stakes heuristic over bcid naming conventions rather than a
// hand-maintained list. Verified against the full current symbolList (111
// entries, all falling into a sensible bucket, none left uncategorized);
// re-run that check if bwip-js adds new symbologies with unusual names.
export const GROUP_ORDER = [
  "Two-dimensional",
  "Stacked (PDF417 family)",
  "GS1 & composite",
  "GS1 DataBar",
  "Retail (EAN/UPC/ISBN)",
  "Postal",
  "Pharmaceutical",
  "HIBC (healthcare)",
  "Linear & other",
] as const;

export type SymbologyGroup = (typeof GROUP_ORDER)[number];

const POSTAL = /^(auspost|daft|flattermarken|identcode|leitcode|japanpost|kix|mailmark|onecode|planet|postnet|royalmail)$/;
const PHARMA = /^(pharmacode|pharmacode2|pzn|code32)$/;
const RETAIL = /^(ean|upc|isbn|ismn|issn|sscc|mands)/;
const TWO_D = /qrcode|datamatrix|azteccode|aztecrune|maxicode|hanxin|dotcode|ultracode|codeone|d3aqr/;
const STACKED = /pdf417|codablockf|code16k|code49/;

export function categorizeSymbology(bcid: string): SymbologyGroup {
  if (bcid.startsWith("hibc")) return "HIBC (healthcare)";
  if (bcid.includes("databar")) return "GS1 DataBar";
  if (bcid.includes("composite") || bcid.startsWith("gs1")) return "GS1 & composite";
  if (TWO_D.test(bcid)) return "Two-dimensional";
  if (STACKED.test(bcid)) return "Stacked (PDF417 family)";
  if (POSTAL.test(bcid)) return "Postal";
  if (PHARMA.test(bcid)) return "Pharmaceutical";
  if (RETAIL.test(bcid)) return "Retail (EAN/UPC/ISBN)";
  return "Linear & other";
}
