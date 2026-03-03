import { prisma } from "./db";
import { AuditAction } from "@vbt/db";

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
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: { orgId, userId, action, entityType, entityId, meta: meta as any },
    });
  } catch (e) {
    console.error("AuditLog write failed:", e);
  }
}
