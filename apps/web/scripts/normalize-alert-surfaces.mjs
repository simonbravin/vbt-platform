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
  [/rounded-sm border border-amber-200 bg-amber-50 p-6 text-amber-800/g, "rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground"],
  [/rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800/g, "rounded-sm border border-alert-warningBorder bg-alert-warning p-4 text-sm text-foreground"],
  [/border border-amber-200 bg-amber-50 p-6 text-amber-800/g, "border border-alert-warningBorder bg-alert-warning p-6 text-foreground"],
  [/p-4 bg-amber-50 text-amber-800 text-sm/g, "rounded-sm border border-alert-warningBorder bg-alert-warning p-4 text-sm text-foreground"],
  [/p-4 bg-amber-50 text-amber-800/g, "rounded-sm border border-alert-warningBorder bg-alert-warning p-4 text-foreground"],
  [/p-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm/g, "rounded-sm border border-alert-errorBorder bg-alert-error p-3 text-sm text-foreground"],
  [/p-3 bg-red-50 border border-red-200 text-sm text-red-700/g, "rounded-sm border border-alert-errorBorder bg-alert-error p-3 text-sm text-foreground"],
  [/rounded-sm bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800/g, "rounded-sm border border-alert-errorBorder bg-alert-error px-4 py-3 text-sm text-foreground"],
  [/rounded-sm bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800/g, "rounded-sm border border-alert-successBorder bg-alert-success px-4 py-3 text-sm text-foreground"],
  [/rounded-sm bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800/g, "rounded-sm border border-alert-successBorder bg-alert-success px-4 py-2 text-sm text-foreground"],
  [/rounded-sm border border-green-200 bg-green-50 p-3 text-sm text-green-800/g, "rounded-sm border border-alert-successBorder bg-alert-success p-3 text-sm text-foreground"],
  [/rounded-sm bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between/g, "flex items-center justify-between rounded-sm border border-alert-successBorder bg-alert-success px-4 py-3 text-sm text-foreground"],
  [/p-4 text-sm text-amber-800 bg-amber-50/g, "rounded-sm border border-alert-warningBorder bg-alert-warning p-4 text-sm text-foreground"],
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
