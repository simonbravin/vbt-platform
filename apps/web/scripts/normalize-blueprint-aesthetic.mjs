/**
 * One-off / repeatable: normalize Tailwind class strings toward blueprint tokens.
 * Run: node apps/web/scripts/normalize-blueprint-aesthetic.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "apps", "web", "src");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

/** Order: longer / more specific first */
const REPLACEMENTS = [
  [/focus:outline-none focus:ring-2 focus:ring-vbt-blue/g, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"],
  [/focus:outline-none focus:ring-1 focus:ring-vbt-blue/g, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"],
  [/focus:ring-2 focus:ring-vbt-blue/g, "focus-visible:ring-2 focus-visible:ring-ring"],
  [/focus:ring-1 focus:ring-vbt-blue/g, "focus-visible:ring-2 focus-visible:ring-ring"],
  [/focus:border-vbt-blue/g, "focus-visible:border-input"],
  [/focus:ring-vbt-blue/g, "focus-visible:ring-ring"],
  [/hover:bg-vbt-blue\/90/g, "hover:opacity-90"],
  [/hover:bg-vbt-blue/g, "hover:opacity-90"],
  [/hover:bg-blue-900/g, "hover:opacity-90"],
  [/hover:bg-blue-50/g, "hover:bg-primary/10"],
  [/text-vbt-blue/g, "text-primary"],
  [/border-vbt-blue/g, "border-primary"],
  [/ring-vbt-blue/g, "ring-primary"],
  [/bg-vbt-blue/g, "bg-primary"],
  [/divide-gray-200/g, "divide-border/60"],
  [/divide-gray-100/g, "divide-border/60"],
  [/divide-gray-50/g, "divide-border/40"],
  [/border-gray-300/g, "border-input"],
  [/border-gray-200/g, "border-border/60"],
  [/border-gray-100/g, "border-border/60"],
  [/hover:bg-gray-50/g, "hover:bg-muted/40"],
  [/hover:bg-gray-100/g, "hover:bg-muted/50"],
  [/hover:text-gray-900/g, "hover:text-foreground"],
  [/hover:text-gray-600/g, "hover:text-muted-foreground"],
  [/hover:text-vbt-blue/g, "hover:text-primary"],
  [/text-gray-900/g, "text-foreground"],
  [/text-gray-800/g, "text-foreground"],
  [/text-gray-700/g, "text-foreground"],
  [/text-gray-600/g, "text-muted-foreground"],
  [/text-gray-500/g, "text-muted-foreground"],
  [/text-gray-400/g, "text-muted-foreground/70"],
  [/text-gray-300/g, "text-muted-foreground/50"],
  [/bg-gray-50/g, "bg-muted/30"],
  [/bg-gray-100/g, "bg-muted"],
  [/bg-gray-200/g, "bg-muted"],
  [/rounded-xl/g, "rounded-sm"],
  [/rounded-lg/g, "rounded-sm"],
];

let changedFiles = 0;
for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [re, rep] of REPLACEMENTS) {
    s = s.replace(re, rep);
  }
  if (s !== orig) {
    fs.writeFileSync(file, s, "utf8");
    changedFiles++;
    console.log(file.replace(process.cwd() + path.sep, ""));
  }
}
console.log(`Done. Updated ${changedFiles} files.`);
