"use client";

import { useT } from "@/lib/i18n/context";

export type PartnerChangeRow = { field: string; from: unknown; to: unknown };

function formatLogValue(value: unknown, t: (key: string) => string, maxLen: number): string {
  if (value === null || value === undefined || value === "") return t("activityLog.valueNull");
  if (typeof value === "boolean") return value ? t("activityLog.valueYes") : t("activityLog.valueNo");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
  try {
    const s = JSON.stringify(value);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return String(value);
  }
}

function fieldLabel(field: string, t: (key: string) => string): string {
  const key = `activityLog.partnerField.${field}`;
  const out = t(key);
  return out === key ? field : out;
}

export function PartnerUpdateChangesList({
  changes,
  compact = false,
  maxItems = 40,
}: {
  changes: unknown;
  compact?: boolean;
  maxItems?: number;
}) {
  const t = useT();
  if (!Array.isArray(changes) || changes.length === 0) return null;
  const list = changes as PartnerChangeRow[];
  const shown = list.slice(0, maxItems);
  const maxValLen = compact ? 48 : 120;

  if (compact) {
    const parts = shown.slice(0, 2).map((c) => {
      const label = fieldLabel(c.field, t);
      return `${label}: ${formatLogValue(c.from, t, maxValLen)} → ${formatLogValue(c.to, t, maxValLen)}`;
    });
    const extra = list.length > 2 ? ` ${t("activityLog.moreChanges", { count: list.length - 2 })}` : "";
    return (
      <span className="block text-xs text-muted-foreground mt-1 leading-snug line-clamp-3">
        {parts.join(" · ")}
        {extra}
      </span>
    );
  }

  return (
    <ul className="mt-2 space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-foreground">
      {shown.map((c) => (
        <li key={c.field} className="leading-relaxed">
          <span className="font-medium text-foreground">{fieldLabel(c.field, t)}</span>
          <span className="text-muted-foreground">: </span>
          <span className="font-mono text-muted-foreground">{formatLogValue(c.from, t, maxValLen)}</span>
          <span className="text-muted-foreground px-1">{t("activityLog.changeArrow")}</span>
          <span className="font-mono text-foreground">{formatLogValue(c.to, t, maxValLen)}</span>
        </li>
      ))}
      {list.length > shown.length ? (
        <li className="text-muted-foreground pt-1">{t("activityLog.moreChanges", { count: list.length - shown.length })}</li>
      ) : null}
    </ul>
  );
}
