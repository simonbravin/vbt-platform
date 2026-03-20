import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../src/lib/i18n/translations.ts");
const text = fs.readFileSync(file, "utf8");
const re = /^    "(partner\.(?:sales|reports)\.[^"]+)":/gm;
const keys = [...text.matchAll(re)].map((m) => m[1]);
const counts = {};
for (const k of keys) counts[k] = (counts[k] ?? 0) + 1;
const bad = Object.entries(counts).filter(([, n]) => n !== 2);
console.log(`partner.sales + partner.reports keys: ${Object.keys(counts).length} unique, ${keys.length} total lines`);
if (bad.length) {
  console.error("Keys not appearing exactly twice (en + es):");
  for (const [k, n] of bad.sort()) console.error(`  ${n}x  ${k}`);
  process.exit(1);
}
console.log("OK: each key appears exactly twice.");
