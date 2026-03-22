"use client";

import type { ReactNode } from "react";
import { parseEngineeringTimelineEvent } from "@vbt/core";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Renders structured engineering timeline payloads or plain note text. */
export function renderEngineeringTimelineBody(
  body: string,
  t: Translate,
  variant: "partner" | "admin" = "partner"
): ReactNode {
  const p = parseEngineeringTimelineEvent(body);
  const emphasis =
    variant === "partner" ? "font-medium text-foreground" : "font-medium text-foreground";
  const plain = variant === "partner" ? "text-sm text-foreground" : "text-sm text-foreground";

  if (p?.k === "partner_file") {
    return (
      <span className={emphasis}>
        {t("partner.engineering.timeline.partnerFile", { name: p.fileName })}
      </span>
    );
  }
  if (p?.k === "platform_revision") {
    return (
      <span className={emphasis}>
        {t("partner.engineering.timeline.platformRevision", {
          label: p.label,
          version: p.version,
        })}
      </span>
    );
  }
  return <span className={`whitespace-pre-wrap ${plain}`}>{body}</span>;
}
