/**
 * Normalize partner + superadmin surfaces (uses globals.css .surface-*).
 * Run from apps/web: node scripts/homogenize-surfaces.mjs
 */
import fs from "node:fs";
import path from "node:path";

const roots = [
  path.join("src", "app", "(dashboard)"),
  path.join("src", "app", "(superadmin)"),
];

function walkTsx(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsx(p, acc);
    else if (ent.isFile() && ent.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/** Longest matches first. */
const REPLACEMENTS = [
  // Settings hub cards (Link)
  [
    'className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-vbt-blue/30 hover:shadow-md transition-all flex items-start gap-4"',
    'className="surface-card p-6 transition-colors hover:border-primary/40 flex items-start gap-4"',
  ],
  // Modals (legacy shadow-xl)
  ["bg-white rounded-xl shadow-xl max-w-md w-full p-6", "surface-modal max-w-md w-full p-6"],
  ["bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4", "surface-modal m-4 w-full max-w-sm p-6"],
  ["bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4", "surface-modal m-4 w-full max-w-md p-6"],
  ["bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg m-4", "surface-modal m-4 w-full max-w-lg p-6"],

  // bg-white border-gray-100
  ["bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden", "surface-card-overflow"],
  ["bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4", "surface-card p-6 space-y-4"],
  ["bg-white rounded-xl shadow-sm border border-gray-100 p-6", "surface-card p-6"],
  ["bg-white rounded-xl shadow-sm border border-gray-100 p-5", "surface-card p-5"],
  ["bg-white rounded-xl shadow-sm border border-gray-100 p-4", "surface-card p-4"],
  ["bg-white rounded-xl shadow-sm border border-gray-100", "surface-card"],
  ["bg-white rounded-xl p-4 shadow-sm border border-gray-100", "surface-card p-4"],

  // gray-200 white surfaces
  ["rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden", "surface-card-overflow"],
  [
    "rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6 max-w-2xl",
    "surface-card max-w-2xl p-6 space-y-6",
  ],
  ["rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6", "surface-card p-6 space-y-6"],
  ["rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-3", "surface-card p-6 space-y-3"],
  ["rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-2xl", "surface-card max-w-2xl p-6"],
  ["rounded-xl border border-gray-200 bg-white shadow-sm p-6", "surface-card p-6"],
  ["rounded-xl border border-gray-200 bg-white shadow-sm max-w-2xl", "surface-card max-w-2xl"],
  ["rounded-xl border border-gray-200 bg-white shadow-sm", "surface-card"],
  ["overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5", "surface-card overflow-hidden p-5"],
  ["overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm", "surface-card-overflow"],
  [
    "rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500",
    "surface-card p-8 text-center text-sm text-muted-foreground",
  ],
  ["rounded-xl border border-gray-200 bg-white p-6 shadow-sm", "surface-card p-6"],
  ["rounded-xl border border-gray-200 bg-white p-6", "surface-card p-6"],

  // Partner projects list
  ["bg-card rounded-xl p-12 text-center shadow-sm border border-border", "surface-card p-12 text-center"],
  [
    "bg-card rounded-xl shadow-sm border border-border p-5 hover:shadow-md transition-shadow",
    "surface-card p-5 transition-colors hover:border-border",
  ],
  ["bg-card rounded-xl shadow-sm border border-border overflow-hidden", "surface-card-overflow"],
  ["bg-card rounded-xl shadow-sm border border-border overflow-x-auto", "surface-card overflow-x-auto"],
  ["bg-card rounded-xl shadow-sm border border-border", "surface-card"],

  // border-border bg-card (already tokenized)
  ["rounded-xl border border-border bg-card overflow-hidden", "surface-card-overflow"],
  ["rounded-xl border border-border bg-card shadow-sm overflow-hidden", "surface-card-overflow"],
  ["overflow-hidden rounded-xl border border-border bg-card shadow-sm", "surface-card-overflow"],
  [
    "rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
    "surface-card p-5 transition-colors hover:border-border",
  ],
  ["rounded-xl border border-border bg-card p-6 shadow-sm", "surface-card p-6"],
  ["rounded-xl border border-border bg-card p-5 shadow-sm", "surface-card p-5"],
  ["rounded-xl border border-border bg-card p-4", "surface-card p-4"],
  ["rounded-xl border border-border bg-card p-8", "surface-card p-8"],
  ["rounded-xl border border-border bg-card shadow-sm", "surface-card"],
  ["rounded-xl border border-border bg-card overflow-hidden mt-4", "surface-card-overflow mt-4"],
  ["space-y-4 rounded-xl border border-border bg-card p-4", "space-y-4 surface-card p-4"],

  // Superadmin quote detail destructive + inventory dropdown
  [
    "rounded-xl border border-destructive/30 bg-destructive/10 p-6 font-medium text-foreground",
    "rounded-sm border border-destructive/30 bg-destructive/10 p-6 font-medium text-foreground",
  ],
  [
    "absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-hidden flex flex-col",
    "absolute z-10 mt-1 flex max-h-64 w-full flex-col overflow-hidden rounded-sm border border-border/60 bg-popover shadow-none ring-1 ring-border/40",
  ],

  // Analytics / reports / dashboard skeletons & alerts
  ['className="h-24 rounded-xl bg-muted animate-pulse"', 'className="h-24 rounded-sm bg-muted animate-pulse"'],
  ['className="h-28 rounded-xl bg-muted animate-pulse"', 'className="h-28 rounded-sm bg-muted animate-pulse"'],
  ['className="h-64 rounded-xl bg-muted animate-pulse"', 'className="h-64 rounded-sm bg-muted animate-pulse"'],
  [
    "rounded-xl border border-alert-warningBorder bg-alert-warning p-6 text-foreground",
    "rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground",
  ],
  [
    "flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 shadow-sm",
    "surface-card flex flex-wrap items-end gap-4 p-4",
  ],

  // Admin countries cards
  [
    "bg-white rounded-xl p-4 shadow-sm border border-gray-100",
    "surface-card p-4",
  ],
  [
    "bg-white rounded-xl p-4 shadow-sm border border-gray-200 opacity-60",
    "surface-card border-border/80 p-4 opacity-60",
  ],

  // Documents admin list row
  [
    "flex flex-col rounded-lg border border-gray-200 bg-gray-50/50 p-4 shadow-sm transition-shadow hover:shadow-md",
    "flex flex-col rounded-sm border border-border/60 bg-muted/20 p-4 transition-colors hover:border-border",
  ],

  // PartnerDetailClient / EditPartner inline-flex buttons with gray
  [
    "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50",
    "inline-flex items-center gap-2 rounded-sm border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted",
  ],
];

const cwd = process.cwd();
const webRoot = cwd.endsWith(path.join("apps", "web")) ? cwd : path.join(cwd, "apps", "web");
process.chdir(webRoot);

let files = [];
for (const r of roots) walkTsx(r, files);
files = [...new Set(files)];

let n = 0;
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  for (const [from, to] of REPLACEMENTS) s = s.split(from).join(to);
  if (s !== orig) {
    fs.writeFileSync(f, s);
    n++;
    console.log(f);
  }
}
console.log("files changed:", n);
