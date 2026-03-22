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

/** `rounded` not already `rounded-*` variant */
const re = /(?<![\w-])rounded(?=\s|"|')/g;

let files = 0;
for (const f of walk(path.join(process.cwd(), "apps", "web", "src"))) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  s = s.replace(re, "rounded-sm");
  if (s !== orig) {
    fs.writeFileSync(f, s, "utf8");
    files++;
    console.log(path.relative(process.cwd(), f));
  }
}
console.log(`Updated ${files} files.`);
