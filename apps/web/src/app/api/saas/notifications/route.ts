import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, isPlatformOperatorContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getNotificationTitleKeyAndLink } from "@/lib/notifications";
import {
  buildNotificationStructuredDetail,
  buildUserLabelMap,
  collectNotificationEnrichmentIds,
  getActorDisplayName,
} from "@/lib/notification-enrichment";
import { withSaaSHandler } from "@/lib/saas-handler";

function notificationsWhere(ctx: { activeOrgId: string | null; isPlatformSuperadmin: boolean }) {
  if (ctx.isPlatformSuperadmin && !ctx.activeOrgId) return {};
  if (ctx.activeOrgId) return { organizationId: ctx.activeOrgId };
  return { organizationId: "none" }; // exclude all for non-superadmin without org
}

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "20", 10) || 20, 50);

  const where = notificationsWhere({
    activeOrgId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin ?? false,
  });

  const superadminOnlyActions = new Set([
    "partner_created",
    "partner_invite_sent",
    "partner_onboarded",
  ]);

  try {
    let rows = await prisma.activityLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        organizationId: true,
        metadataJson: true,
        createdAt: true,
        organization: { select: { name: true } },
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
    });

    if (!isPlatformOperatorContext(ctx)) {
      rows = rows.filter((r) => {
        const a = r.action.toLowerCase();
        if (superadminOnlyActions.has(a)) return false;
        if (a === "partner_updated" && r.organizationId !== ctx.activeOrgId) return false;
        if (
          r.entityType.toLowerCase() === "engineering_request" &&
          (r.action.toLowerCase() === "engineering_review_note" ||
            r.action.toLowerCase() === "engineering_review_event_created")
        ) {
          const meta = r.metadataJson as { visibility?: string } | null | undefined;
          if (meta?.visibility === "internal") return false;
        }
        return true;
      });
    }
    rows = rows.slice(0, limit);

    const { projectIds, quoteIds, userIds, programIds } = collectNotificationEnrichmentIds(rows);

    const [projects, quotes, users, programs] = await Promise.all([
      projectIds.size > 0
        ? prisma.project.findMany({
            where: { id: { in: [...projectIds] } },
            select: { id: true, projectName: true },
          })
        : Promise.resolve([]),
      quoteIds.size > 0
        ? prisma.quote.findMany({
            where: { id: { in: [...quoteIds] } },
            select: { id: true, quoteNumber: true },
          })
        : Promise.resolve([]),
      userIds.size > 0
        ? prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve([]),
      programIds.size > 0
        ? prisma.trainingProgram.findMany({
            where: { id: { in: [...programIds] } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    const maps = {
      projectNameById: Object.fromEntries(projects.map((p) => [p.id, p.projectName])),
      quoteNumberById: Object.fromEntries(quotes.map((q) => [q.id, q.quoteNumber])),
      userLabelById: buildUserLabelMap(users),
      programTitleById: Object.fromEntries(programs.map((p) => [p.id, p.title])),
    };

    const notifications = rows.map((row) => {
      const { titleKey, link } = getNotificationTitleKeyAndLink({
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        organizationId: row.organizationId ?? null,
        isSuperadmin: ctx.isPlatformSuperadmin ?? false,
      });
      const detail = buildNotificationStructuredDetail(row, maps);
      return {
        id: row.id,
        action: row.action,
        titleKey,
        link,
        createdAt: row.createdAt,
        organizationId: row.organizationId ?? undefined,
        organizationName: row.organization?.name ?? undefined,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadataJson,
        actorDisplay: getActorDisplayName(row.user),
        detail: detail ?? undefined,
      };
    });

    return NextResponse.json(notifications);
  } catch (e) {
    console.error("[saas/notifications]", e);
    return NextResponse.json([]);
  }
}

export const GET = withSaaSHandler({}, getHandler);
