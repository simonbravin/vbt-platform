import { prisma } from "./db";

export async function createActivityLog({
  organizationId,
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId: organizationId ?? undefined,
        userId: userId ?? undefined,
        action,
        entityType,
        entityId,
        metadataJson: metadata == null ? undefined : (metadata as object),
      },
    });
  } catch (e) {
    console.error("ActivityLog write failed:", e);
  }
}

/** @deprecated Use createActivityLog with string action and metadata. */
export async function createAuditLog({
  orgId,
  userId,
  action,
  entityType,
  entityId,
  meta,
}: {
  orgId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  return createActivityLog({
    organizationId: orgId ?? undefined,
    userId: userId ?? undefined,
    action,
    entityType: entityType ?? "unknown",
    entityId: entityId ?? "",
    metadata: meta,
  });
}
