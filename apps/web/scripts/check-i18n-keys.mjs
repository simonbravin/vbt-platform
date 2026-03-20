/**
 * Verifies that apps/web/src/lib/i18n/translations.ts has identical key sets in `en` and `es`,
 * and no duplicate keys within each locale object.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../src/lib/i18n/translations.ts");
const text = fs.readFileSync(file, "utf8");

/** Find `{` that opens `en: {` or `es: {` (first brace after the colon). */
function findLocaleBlockStart(src, marker) {
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error(`Marker not found: ${marker}`);
  const brace = src.indexOf("{", idx);
  if (brace === -1) throw new Error(`Opening brace not found after ${marker}`);
  return brace;
}

/** Slice from opening `{` to matching closing `}` at depth 0. */
function extractBraceContent(src, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(openBraceIndex + 1, i);
    }
  }
  throw new Error("Unbalanced braces in translations.ts");
}

function collectKeys(blockContent) {
  const keys = [];
  const keyRe = /^\s*"([^"]+)":\s*/gm;
  let m;
  while ((m = keyRe.exec(blockContent)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

function duplicates(keys) {
  const seen = new Map();
  for (const k of keys) {
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ key: k, count: n }));
}

const enOpen = findLocaleBlockStart(text, "en: {");
const enInner = extractBraceContent(text, enOpen);
const esOpen = findLocaleBlockStart(text, "es: {");
const esInner = extractBraceContent(text, esOpen);

const enKeys = collectKeys(enInner);
const esKeys = collectKeys(esInner);

const enSet = new Set(enKeys);
const esSet = new Set(esKeys);

const missingInEs = [...enSet].filter((k) => !esSet.has(k)).sort();
const missingInEn = [...esSet].filter((k) => !enSet.has(k)).sort();
const dupEn = duplicates(enKeys);
const dupEs = duplicates(esKeys);

let failed = false;

if (dupEn.length) {
  console.error("Duplicate keys in `en`:");
  for (const { key, count } of dupEn) console.error(`  ${count}x  ${key}`);
  failed = true;
}
if (dupEs.length) {
  console.error("Duplicate keys in `es`:");
  for (const { key, count } of dupEs) console.error(`  ${count}x  ${key}`);
  failed = true;
}
if (missingInEs.length) {
  console.error(`Keys in en but missing in es (${missingInEs.length}):`);
  for (const k of missingInEs) console.error(`  ${k}`);
  failed = true;
}
if (missingInEn.length) {
  console.error(`Keys in es but missing in en (${missingInEn.length}):`);
  for (const k of missingInEn) console.error(`  ${k}`);
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(`OK: ${enSet.size} keys, en and es match, no duplicates per locale.`);
