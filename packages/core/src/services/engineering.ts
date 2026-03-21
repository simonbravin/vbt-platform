import type {
  PrismaClient,
  EngineeringRequestStatus,
  EngineeringReviewVisibility,
} from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

export type ListEngineeringRequestsOptions = {
  projectId?: string;
  /** Superadmin: filter by partner organization id */
  organizationId?: string;
  assignedToUserId?: string;
  status?: EngineeringRequestStatus;
  /** Case-insensitive match on request number, project name, notes, type fields, or id substring */
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listEngineeringRequests(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListEngineeringRequestsOptions = {}
) {
  const orgWhere = orgScopeWhere(ctx);
  const searchTerm = options.search?.trim();
  const searchWhere =
    searchTerm && searchTerm.length > 0
      ? {
          OR: [
            { requestNumber: { contains: searchTerm, mode: "insensitive" as const } },
            { id: { contains: searchTerm, mode: "insensitive" as const } },
            { notes: { contains: searchTerm, mode: "insensitive" as const } },
            { requestType: { contains: searchTerm, mode: "insensitive" as const } },
            { systemType: { contains: searchTerm, mode: "insensitive" as const } },
            { project: { projectName: { contains: searchTerm, mode: "insensitive" as const } } },
          ],
        }
      : {};
  const where = {
    ...orgWhere,
    ...(ctx.isPlatformSuperadmin && options.organizationId && { organizationId: options.organizationId }),
    ...(options.projectId && { projectId: options.projectId }),
    ...(options.assignedToUserId && { assignedToUserId: options.assignedToUserId }),
    ...(options.status && { status: options.status }),
    ...searchWhere,
  };
  const [requests, total] = await Promise.all([
    prisma.engineeringRequest.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        project: { select: { id: true, projectName: true, countryCode: true } },
        requestedByUser: { select: { id: true, fullName: true } },
        assignedToUser: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.engineeringRequest.count({ where }),
  ]);
  return { requests, total };
}

export async function getEngineeringRequestById(
  prisma: PrismaClient,
  ctx: TenantContext,
  requestId: string,
  options?: { includeInternalReviews?: boolean }
) {
  const orgWhere = orgScopeWhere(ctx);
  const includeInternal = !!options?.includeInternalReviews && ctx.isPlatformSuperadmin;
  return prisma.engineeringRequest.findFirst({
    where: { id: requestId, ...orgWhere },
    include: {
      organization: { select: { id: true, name: true } },
      project: true,
      requestedByUser: { select: { id: true, fullName: true, email: true } },
      assignedToUser: { select: { id: true, fullName: true, email: true } },
      files: true,
      deliverables: true,
      reviewEvents: {
        where: includeInternal ? {} : { visibility: "partner" },
        orderBy: { createdAt: "asc" },
        include: {
          authorUser: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });
}

export type CreateEngineeringRequestInput = {
  projectId: string;
  requestNumber: string;
  requestType?: string | null;
  wallAreaM2?: number | null;
  systemType?: string | null;
  targetDeliveryDate?: Date | null;
  engineeringFeeValue?: number | null;
  notes?: string | null;
};

export type CreateEngineeringRequestInputWithStatus = CreateEngineeringRequestInput & {
  status?: EngineeringRequestStatus;
};

export async function createEngineeringRequest(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: CreateEngineeringRequestInputWithStatus
) {
  const organizationId = ctx.organizationId ?? undefined;
  if (!organizationId && !ctx.isPlatformSuperadmin) {
    throw new Error("Organization context required to create engineering request");
  }
  const orgWhere = orgScopeWhere(ctx);
  await prisma.project.findFirstOrThrow({
    where: { id: input.projectId, ...orgWhere },
  });
  return prisma.engineeringRequest.create({
    data: {
      organizationId: organizationId!,
      projectId: input.projectId,
      requestNumber: input.requestNumber,
      status: input.status ?? "draft",
      requestedByUserId: ctx.userId,
      requestType: input.requestType ?? undefined,
      wallAreaM2: input.wallAreaM2 ?? undefined,
      systemType: input.systemType ?? undefined,
      targetDeliveryDate: input.targetDeliveryDate ?? undefined,
      engineeringFeeValue: input.engineeringFeeValue ?? undefined,
      notes: input.notes ?? undefined,
    },
  });
}

export type UpdateEngineeringRequestInput = {
  status?: EngineeringRequestStatus;
  assignedToUserId?: string | null;
  requestType?: string | null;
  wallAreaM2?: number | null;
  systemType?: string | null;
  targetDeliveryDate?: Date | null;
  engineeringFeeValue?: number | null;
  notes?: string | null;
};

export async function updateEngineeringRequest(
  prisma: PrismaClient,
  ctx: TenantContext,
  requestId: string,
  data: UpdateEngineeringRequestInput
) {
  const orgWhere = orgScopeWhere(ctx);
  await prisma.engineeringRequest.findFirstOrThrow({
    where: { id: requestId, ...orgWhere },
  });
  return prisma.engineeringRequest.update({
    where: { id: requestId },
    data: {
      ...(data.status != null && { status: data.status }),
      ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId }),
      ...(data.requestType !== undefined && { requestType: data.requestType }),
      ...(data.wallAreaM2 !== undefined && { wallAreaM2: data.wallAreaM2 }),
      ...(data.systemType !== undefined && { systemType: data.systemType }),
      ...(data.targetDeliveryDate !== undefined && { targetDeliveryDate: data.targetDeliveryDate }),
      ...(data.engineeringFeeValue !== undefined && { engineeringFeeValue: data.engineeringFeeValue }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

export type AddEngineeringFileInput = {
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  fileUrl: string; // storageUrl: use same field
};

export async function addEngineeringFile(
  prisma: PrismaClient,
  ctx: TenantContext,
  requestId: string,
  input: AddEngineeringFileInput
) {
  const orgWhere = orgScopeWhere(ctx);
  await prisma.engineeringRequest.findFirstOrThrow({
    where: { id: requestId, ...orgWhere },
  });
  return prisma.engineeringFile.create({
    data: {
      engineeringRequestId: requestId,
      fileName: input.fileName,
      fileType: input.fileType ?? null,
      fileSize: input.fileSize ?? null,
      fileUrl: input.fileUrl,
      uploadedByUserId: ctx.userId,
    },
  });
}

export type AddDeliverableInput = {
  title?: string | null;
  description?: string | null;
  fileUrl: string;
};

export async function addDeliverable(
  prisma: PrismaClient,
  ctx: TenantContext,
  requestId: string,
  input: AddDeliverableInput
) {
  const orgWhere = orgScopeWhere(ctx);
  await prisma.engineeringRequest.findFirstOrThrow({
    where: { id: requestId, ...orgWhere },
  });
  const fileName = input.fileUrl.split("/").pop() ?? "deliverable";
  return prisma.engineeringDeliverable.create({
    data: {
      engineeringRequestId: requestId,
      deliverableType: input.title ?? "deliverable",
      title: input.title ?? null,
      description: input.description ?? null,
      fileName,
      fileUrl: input.fileUrl,
      uploadedByUserId: ctx.userId,
    },
  });
}

export async function updateEngineeringRequestStatus(
  prisma: PrismaClient,
  ctx: TenantContext,
  requestId: string,
  status: EngineeringRequestStatus,
  assignedToUserId?: string | null
) {
  const orgWhere = orgScopeWhere(ctx);
  await prisma.engineeringRequest.findFirstOrThrow({
    where: { id: requestId, ...orgWhere },
  });
  return prisma.engineeringRequest.update({
    where: { id: requestId },
    data: {
      status,
      ...(assignedToUserId !== undefined && { assignedToUserId }),
    },
  });
}

export async function projectHasDeliveredEngineering(
  prisma: PrismaClient,
  organizationId: string,
  projectId: string
): Promise<boolean> {
  const n = await prisma.engineeringRequest.count({
    where: { organizationId, projectId, status: "delivered" },
  });
  return n > 0;
}

export async function assertEngineeringRequestForQuote(
  prisma: PrismaClient,
  organizationId: string,
  projectId: string,
  engineeringRequestId: string | null | undefined
): Promise<void> {
  if (!engineeringRequestId) return;
  const er = await prisma.engineeringRequest.findFirst({
    where: { id: engineeringRequestId, organizationId, projectId },
    select: { id: true },
  });
  if (!er) throw new Error("engineeringRequestId does not match project or organization");
}

export type AddEngineeringReviewEventInput = {
  body: string;
  visibility: EngineeringReviewVisibility;
  toStatus?: EngineeringRequestStatus | null;
};

/**
 * Creates a timeline event; optionally updates request status in the same transaction.
 * Partners may only use visibility `partner` and toStatus `submitted` when resubmitting from draft / needs_info / pending_info.
 */
export async function addEngineeringReviewEvent(
  prisma: PrismaClient,
  ctx: TenantContext,
  requestId: string,
  input: AddEngineeringReviewEventInput
) {
  const orgWhere = orgScopeWhere(ctx);
  const existing = await prisma.engineeringRequest.findFirst({
    where: { id: requestId, ...orgWhere },
  });
  if (!existing) throw new Error("Engineering request not found");

  if (!ctx.isPlatformSuperadmin) {
    if (input.visibility !== "partner") {
      throw new Error("Partners may only create partner-visible review notes");
    }
    if (ctx.organizationId != null && existing.organizationId !== ctx.organizationId) {
      throw new Error("Forbidden");
    }
    if (input.toStatus != null) {
      if (input.toStatus !== "submitted") {
        throw new Error("Invalid status transition for partner");
      }
      const from = existing.status;
      const canSubmit = from === "draft" || from === "needs_info" || from === "pending_info";
      if (!canSubmit) {
        throw new Error("Cannot resubmit from current status");
      }
    }
  }

  const fromStatus = existing.status;
  const toStatus = input.toStatus ?? undefined;

  return prisma.$transaction(async (tx) => {
    const event = await tx.engineeringReviewEvent.create({
      data: {
        engineeringRequestId: requestId,
        authorUserId: ctx.userId,
        visibility: input.visibility,
        body: input.body,
        fromStatus,
        toStatus: toStatus ?? null,
      },
    });
    if (toStatus != null) {
      await tx.engineeringRequest.update({
        where: { id: requestId },
        data: { status: toStatus },
      });
    }
    return event;
  });
}
