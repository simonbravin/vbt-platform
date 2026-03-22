/**
 * Map legacy Tailwind chromatic badges to blueprint-friendly semantic tokens.
 */
import fs from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const REPLACEMENTS = [
  [/bg-green-100 text-green-800 dark:bg-green-900\/30 dark:text-green-400/g, "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"],
  [/bg-blue-100 text-blue-800 dark:bg-blue-900\/30 dark:text-blue-400/g, "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"],
  [/bg-green-100 text-green-800/g, "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"],
  [/bg-green-100 text-green-700/g, "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"],
  [/bg-amber-100 text-amber-800/g, "bg-amber-500/15 text-amber-900 dark:text-amber-200"],
  [/bg-amber-100 text-amber-700/g, "bg-amber-500/15 text-amber-900 dark:text-amber-200"],
  [/bg-blue-100 text-blue-800/g, "bg-primary/10 text-primary"],
  [/bg-blue-100 text-blue-700/g, "bg-primary/10 text-primary"],
  [/bg-purple-100 text-purple-700/g, "bg-muted text-foreground"],
  [/bg-blue-50 dark:bg-blue-950\/40/g, "bg-primary/10 dark:bg-primary/15"],
  [/bg-blue-50 /g, "bg-primary/10 "],
  [/text-vbt-orange/g, "text-primary"],
  [/border-vbt-orange/g, "border-primary"],
  [/hover:bg-orange-50/g, "hover:bg-primary/10"],
  [/border-orange-600\/30/g, "border-vbt-orange/30"],
  // Filled orange CTAs: add brand border (if not already present in string — idempotent-ish)
];

let n = 0;
for (const f of walk(path.join(process.cwd(), "apps", "web", "src"))) {
  let s = fs.readFileSync(f, "utf8");
  const o = s;
  for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep);
  if (s !== o) {
    fs.writeFileSync(f, s, "utf8");
    n++;
    console.log(path.relative(process.cwd(), f));
  }
}
console.log(`Updated ${n} files.`);
