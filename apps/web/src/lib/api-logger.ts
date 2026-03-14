/**
 * Structured logging for API routes. Safe for production and external log systems.
 */

export type ApiLogEntry = {
  level: "info" | "warn" | "error";
  endpoint: string;
  method: string;
  userId?: string | null;
  organizationId?: string | null;
  durationMs: number;
  status: number;
  message?: string;
  error?: string;
};

function formatLog(entry: ApiLogEntry): string {
  return JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

export function logApiRequest(entry: ApiLogEntry): void {
  const line = formatLog(entry);
  if (entry.status >= 500 || entry.level === "error") {
    console.error(line);
  } else if (entry.status >= 400) {
    console.warn(line);
  } else {
    console.info(line);
  }
}
