import type {
  PrismaClient,
  EngineeringRequest,
  EngineeringRequestStatus,
} from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

export type ListEngineeringRequestsOptions = {
  projectId?: string;
  status?: EngineeringRequestStatus;
  limit?: number;
  offset?: number;
};

export async function listEngineeringRequests(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListEngineeringRequestsOptions = {}
): Promise<{ requests: EngineeringRequest[]; total: number }> {
  const orgWhere = orgScopeWhere(ctx);
  const where = {
    ...orgWhere,
    ...(options.projectId && { projectId: options.projectId }),
    ...(options.status && { status: options.status }),
  };
  const [requests, total] = await Promise.all([
    prisma.engineeringRequest.findMany({
      where,
      include: {
        project: { select: { id: true, projectName: true } },
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
  requestId: string
): Promise<EngineeringRequest | null> {
  const orgWhere = orgScopeWhere(ctx);
  return prisma.engineeringRequest.findFirst({
    where: { id: requestId, ...orgWhere },
    include: {
      project: true,
      requestedByUser: { select: { id: true, fullName: true, email: true } },
      assignedToUser: { select: { id: true, fullName: true, email: true } },
      files: true,
      deliverables: true,
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
