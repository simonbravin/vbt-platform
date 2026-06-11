export type ProjectBaselineRow = {
  id: string;
  clientId: string | null;
  baselineQuoteId: string | null;
};

export type SaleProjectLineInput = {
  projectId: string;
  quoteId?: string | null;
};

/**
 * Validates multi-project sale lines: no duplicates, projects exist, same client,
 * and each line has a quote (explicit on the line or baseline on the project).
 */
export function validateSaleProjectLinesBaselineAndClient(
  lines: SaleProjectLineInput[],
  projects: ProjectBaselineRow[],
  expectedClientId: string
): void {
  const ids = lines.map((l) => l.projectId);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("Duplicate project in sale lines");
  }
  if (projects.length !== unique.size) {
    throw new Error("One or more projects were not found");
  }
  const byId = new Map(projects.map((p) => [p.id, p]));
  const lineByProject = new Map(lines.map((l) => [l.projectId, l]));
  for (const id of unique) {
    const p = byId.get(id);
    if (!p) {
      throw new Error("One or more projects were not found");
    }
    if (p.clientId !== expectedClientId) {
      throw new Error("All projects must belong to the selected client");
    }
    const line = lineByProject.get(id);
    const resolvedQuoteId = line?.quoteId?.trim() || p.baselineQuoteId;
    if (!resolvedQuoteId) {
      throw new Error("Each project line must include a quote or have a baseline quote on the project");
    }
  }
}
