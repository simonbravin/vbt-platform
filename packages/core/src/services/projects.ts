import type { PrismaClient, Project, ProjectStatus } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

export type ListProjectsOptions = {
  status?: ProjectStatus;
  clientId?: string;
  organizationId?: string;
  countryCode?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listProjects(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListProjectsOptions = {}
): Promise<{ projects: Project[]; total: number }> {
  const orgWhere = orgScopeWhere(ctx);
  const where = {
    ...orgWhere,
    ...(options.status && { status: options.status }),
    ...(options.clientId && { clientId: options.clientId }),
    ...(ctx.isPlatformSuperadmin && options.organizationId && { organizationId: options.organizationId }),
    ...(options.countryCode && { countryCode: options.countryCode }),
    ...(options.search?.trim() && {
      OR: [
        { projectName: { contains: options.search.trim(), mode: "insensitive" as const } },
        { projectCode: { contains: options.search.trim(), mode: "insensitive" as const } },
        { description: { contains: options.search.trim(), mode: "insensitive" as const } },
      ],
    }),
  };
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, fullName: true } },
        _count: { select: { quotes: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.project.count({ where }),
  ]);
  return { projects, total };
}

export async function getProjectById(
  prisma: PrismaClient,
  ctx: TenantContext,
  projectId: string
): Promise<Project | null> {
  const orgWhere = orgScopeWhere(ctx);
  return prisma.project.findFirst({
    where: { id: projectId, ...orgWhere },
    include: {
      client: true,
      assignedToUser: { select: { id: true, fullName: true, email: true } },
      quotes: { orderBy: { version: "desc" }, take: 10 },
    },
  });
}

export type CreateProjectInput = {
  projectName: string;
  projectCode?: string | null;
  clientId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  projectType?: string | null;
  status?: ProjectStatus;
  estimatedTotalAreaM2?: number | null;
  estimatedWallAreaM2?: number | null;
  estimatedUnits?: number | null;
  wallHeightM?: number | null;
  description?: string | null;
  competitionNotes?: string | null;
  probabilityPct?: number | null;
  expectedCloseDate?: Date | null;
  assignedToUserId?: string | null;
};

export async function createProject(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: CreateProjectInput
): Promise<Project> {
  const organizationId = ctx.organizationId ?? undefined;
  if (!organizationId && !ctx.isPlatformSuperadmin) {
    throw new Error("Organization context required to create project");
  }
  if (input.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      select: { organizationId: true },
    });
    if (!client || client.organizationId !== organizationId) {
      throw new Error("Client does not belong to your organization");
    }
  }
  return prisma.project.create({
    data: {
      organizationId: organizationId!,
      projectName: input.projectName,
      projectCode: input.projectCode ?? undefined,
      clientId: input.clientId ?? undefined,
      countryCode: input.countryCode ?? undefined,
      city: input.city ?? undefined,
      address: input.address ?? undefined,
      projectType: input.projectType ?? undefined,
      status: input.status ?? "lead",
      estimatedTotalAreaM2: input.estimatedTotalAreaM2 ?? undefined,
      estimatedWallAreaM2: input.estimatedWallAreaM2 ?? undefined,
      estimatedUnits: input.estimatedUnits ?? undefined,
      wallHeightM: input.wallHeightM ?? undefined,
      description: input.description ?? undefined,
      competitionNotes: input.competitionNotes ?? undefined,
      probabilityPct: input.probabilityPct ?? undefined,
      expectedCloseDate: input.expectedCloseDate ?? undefined,
      assignedToUserId: input.assignedToUserId ?? undefined,
    },
  });
}

export async function updateProject(
  prisma: PrismaClient,
  ctx: TenantContext,
  projectId: string,
  data: Partial<CreateProjectInput>
): Promise<Project> {
  const orgWhere = orgScopeWhere(ctx);
  const existing = await prisma.project.findFirstOrThrow({
    where: { id: projectId, ...orgWhere },
    select: { organizationId: true },
  });
  if (data.clientId !== undefined && data.clientId !== null) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { organizationId: true },
    });
    if (!client || client.organizationId !== existing.organizationId) {
      throw new Error("Client does not belong to this project's organization");
    }
  }
  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.projectName != null && { projectName: data.projectName }),
      ...(data.projectCode !== undefined && { projectCode: data.projectCode }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.countryCode !== undefined && { countryCode: data.countryCode }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.projectType !== undefined && { projectType: data.projectType }),
      ...(data.status != null && { status: data.status }),
      ...(data.estimatedTotalAreaM2 !== undefined && { estimatedTotalAreaM2: data.estimatedTotalAreaM2 }),
      ...(data.estimatedWallAreaM2 !== undefined && { estimatedWallAreaM2: data.estimatedWallAreaM2 }),
      ...(data.estimatedUnits !== undefined && { estimatedUnits: data.estimatedUnits }),
      ...(data.wallHeightM !== undefined && { wallHeightM: data.wallHeightM }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.competitionNotes !== undefined && { competitionNotes: data.competitionNotes }),
      ...(data.probabilityPct !== undefined && { probabilityPct: data.probabilityPct }),
      ...(data.expectedCloseDate !== undefined && { expectedCloseDate: data.expectedCloseDate }),
      ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId }),
    },
  });
}
