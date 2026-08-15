import type { ReactNode } from "react";
import { normalizeQuoteStatus } from "@vbt/core";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-primary/35 bg-primary/10 text-primary",
  success: "border-primary/40 bg-primary/10 text-foreground",
  warning: "border-alert-warningBorder bg-alert-warning text-foreground",
  danger: "border-destructive/45 bg-destructive/10 text-destructive",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function quoteStatusTone(status: string | null | undefined): StatusTone {
  const n = normalizeQuoteStatus(status ?? "draft") ?? "draft";
  if (n === "sent") return "info";
  if (n === "draft") return "warning";
  if (n === "accepted") return "success";
  if (n === "rejected") return "danger";
  return "neutral";
}

export function projectStatusTone(status: string | null | undefined): StatusTone {
  if (status === "won") return "success";
  if (status === "lost") return "danger";
  if (status === "quoting" || status === "engineering") return "info";
  if (status === "on_hold") return "warning";
  return "neutral";
}
