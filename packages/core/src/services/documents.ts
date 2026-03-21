import type { Prisma, PrismaClient, DocumentCategory } from "@vbt/db";

/** Platform doc country field vs viewer ISO-2 (supports comma-separated scopes in DB). */
export function documentCountryVisibleToViewer(
  docCountryScope: string | null | undefined,
  viewerCountryCode: string | null
): boolean {
  const scopeRaw = (docCountryScope ?? "").trim();
  if (!scopeRaw || scopeRaw === "*") return true;
  const viewer = (viewerCountryCode ?? "").trim().toUpperCase();
  if (!viewer) return false;
  const normScope = scopeRaw.toUpperCase();
  if (normScope === viewer) return true;
  const parts = normScope.split(/[\s,;]+/).map((p) => p.trim().toUpperCase()).filter(Boolean);
  return parts.includes(viewer);
}

function buildPlatformCountryWhere(viewerCode: string | null): Prisma.DocumentWhereInput {
  if (viewerCode) {
    const C = viewerCode;
    return {
      OR: [
        { countryScope: null },
        { countryScope: "" },
        { countryScope: "*" },
        { countryScope: { equals: C, mode: "insensitive" } },
        { countryScope: { startsWith: `${C},`, mode: "insensitive" } },
        { countryScope: { endsWith: `,${C}`, mode: "insensitive" } },
        { countryScope: { contains: `,${C},`, mode: "insensitive" } },
      ],
    };
  }
  return {
    OR: [{ countryScope: null }, { countryScope: "" }, { countryScope: "*" }],
  };
}

const PARTNER_ORG_TYPES = ["commercial_partner", "master_partner"] as const;

export class InvalidDocumentOrgIdsError extends Error {
  constructor() {
    super("Invalid partner organization ids for document allowlist");
    this.name = "InvalidDocumentOrgIdsError";
  }
}

const documentListInclude = {
  category: { select: { id: true, name: true, code: true } },
  allowedOrganizations: {
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  },
} as const;

async function assertPartnerOrgIds(
  prisma: Prisma.TransactionClient | PrismaClient,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const rows = await prisma.organization.findMany({
    where: { id: { in: ids }, organizationType: { in: [...PARTNER_ORG_TYPES] } },
    select: { id: true },
  });
  if (rows.length !== ids.length) {
    throw new InvalidDocumentOrgIdsError();
  }
}

export type DocumentForAccess = {
  organizationId: string | null;
  visibility: string;
  countryScope?: string | null;
  allowedOrganizations?: { organizationId: string }[];
};

export type DocumentReadContext = {
  isPlatformSuperadmin: boolean;
  activeOrgId: string | null;
  /** From active org (or query override in list). Ignored when superadmin has no active org. */
  viewerCountryCode?: string | null;
};

/** Read access: list, GET one, file download. */
export function canReadDocument(doc: DocumentForAccess, ctx: DocumentReadContext): boolean {
  if (!ctx) return false;
  if (!ctx.isPlatformSuperadmin && doc.visibility === "internal") return false;

  if (doc.organizationId) {
    if (ctx.isPlatformSuperadmin) return true;
    return ctx.activeOrgId === doc.organizationId;
  }

  if (ctx.activeOrgId) {
    if (!documentCountryVisibleToViewer(doc.countryScope ?? null, ctx.viewerCountryCode ?? null)) {
      return false;
    }
  }

  if (ctx.isPlatformSuperadmin && !ctx.activeOrgId) return true;
  if (!ctx.activeOrgId) return false;

  const allowed = doc.allowedOrganizations ?? [];
  if (allowed.length === 0) return true;
  return allowed.some((a) => a.organizationId === ctx.activeOrgId);
}

/** Write access: PATCH (and future partner-owned uploads). Platform docs: superadmin only. */
export function canMutateDocument(
  doc: { organizationId: string | null },
  ctx: { isPlatformSuperadmin: boolean; activeOrgId: string | null }
): boolean {
  if (ctx.isPlatformSuperadmin) return true;
  if (!doc.organizationId) return false;
  return ctx.activeOrgId === doc.organizationId;
}

/**
 * Document library: platform docs have organizationId null; partner docs have organizationId set.
 * When organizationId is passed (partner), list returns platform docs (with allowlist/country rules) + that org's docs only.
 */
export type ListDocumentsOptions = {
  categoryId?: string;
  categoryCode?: string;
  visibility?: "public" | "partners_only" | "internal";
  /** Exclude these visibility values (e.g. hide `internal` for partners). */
  excludeVisibilities?: ("public" | "partners_only" | "internal")[];
  projectId?: string;
  engineeringRequestId?: string;
  /** When set (partner), filter to platform docs (org null) + this org's docs. When omitted (superadmin), no org filter. */
  organizationId?: string | null;
  /**
   * When listing with `organizationId`, restricts **platform** rows by country (null = org sin país → solo docs globales).
   * `undefined` = no filtro por país (listado superadmin sin contexto de org).
   */
  partnerViewerCountryCode?: string | null;
  limit?: number;
  offset?: number;
};

export async function listDocumentCategories(
  prisma: PrismaClient
): Promise<DocumentCategory[]> {
  return prisma.documentCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function listDocuments(prisma: PrismaClient, options: ListDocumentsOptions = {}) {
  const and: Record<string, unknown>[] = [];
  const base: Record<string, unknown> = {};
  if (options.categoryId) base.categoryId = options.categoryId;
  if (options.categoryCode) {
    const cat = await prisma.documentCategory.findUnique({
      where: { code: options.categoryCode },
    });
    if (cat) base.categoryId = cat.id;
  }
  if (options.visibility) base.visibility = options.visibility;
  if (options.projectId) base.projectId = options.projectId;
  if (options.engineeringRequestId) base.engineeringRequestId = options.engineeringRequestId;
  and.push(base);
  if (options.organizationId !== undefined && options.organizationId !== null) {
    const platformAnd: Prisma.DocumentWhereInput[] = [
      { organizationId: null },
      {
        OR: [
          { allowedOrganizations: { none: {} } },
          {
            allowedOrganizations: {
              some: { organizationId: options.organizationId },
            },
          },
        ],
      },
    ];
    if (options.partnerViewerCountryCode !== undefined) {
      platformAnd.push(buildPlatformCountryWhere(options.partnerViewerCountryCode));
    }
    and.push({
      OR: [{ organizationId: options.organizationId }, { AND: platformAnd }],
    });
  }
  if (options.excludeVisibilities?.length) {
    and.push({ NOT: { visibility: { in: options.excludeVisibilities } } });
  }
  const where = and.length === 1 ? and[0] : { AND: and };
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: documentListInclude,
      orderBy: [{ categoryId: "asc" }, { title: "asc" }],
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    }),
    prisma.document.count({ where }),
  ]);
  return { documents, total };
}

/** Tenant + role context for document library (foundation for partner scaling). */
export type DocumentVisibilityContext = {
  organizationId: string | null;
  /** Partner org default country / filter (ISO-2). */
  countryCode?: string | null;
  isPlatformSuperadmin: boolean;
  /** Reserved for future rules (e.g. technical_user). */
  role?: string | null;
};

/**
 * Single entry point for “what documents may this principal see”.
 * - Superadmin: all visibilities, optional org filter via `options.organizationId`.
 * - Partner: platform + org docs, never `internal`, optional country scope.
 */
export async function getVisibleDocuments(
  prisma: PrismaClient,
  ctx: DocumentVisibilityContext,
  options: Omit<ListDocumentsOptions, "organizationId" | "partnerViewerCountryCode"> & {
    /** Query override; takes precedence over ctx.countryCode when listing with an org context. */
    countryScope?: string;
    organizationId?: string | null;
  } = {}
) {
  if (!ctx.isPlatformSuperadmin && !ctx.organizationId) {
    return { documents: [], total: 0 };
  }

  const orgForList =
    options.organizationId !== undefined ? options.organizationId : (ctx.organizationId ?? undefined);

  let partnerViewerCountryCode: string | null | undefined = undefined;
  if (orgForList != null) {
    const fromQuery =
      options.countryScope != null && options.countryScope !== ""
        ? options.countryScope.trim().toUpperCase()
        : undefined;
    partnerViewerCountryCode =
      fromQuery !== undefined
        ? fromQuery
        : ctx.countryCode != null && ctx.countryCode !== ""
          ? ctx.countryCode.trim().toUpperCase()
          : null;
  }

  const { countryScope: _q, organizationId: _oid, ...rest } = options;

  const listOptions: ListDocumentsOptions = {
    ...rest,
    organizationId: orgForList,
    partnerViewerCountryCode,
  };

  if (!ctx.isPlatformSuperadmin) {
    listOptions.excludeVisibilities = ["internal"];
  }

  return listDocuments(prisma, listOptions);
}

export async function getDocumentById(prisma: PrismaClient, documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: {
      category: true,
      allowedOrganizations: {
        select: {
          organizationId: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export type CreateDocumentInput = {
  title: string;
  description?: string | null;
  categoryId: string;
  fileUrl: string;
  visibility?: "public" | "partners_only" | "internal";
  countryScope?: string | null;
  documentType?: string | null;
  projectId?: string | null;
  engineeringRequestId?: string | null;
  organizationId?: string | null;
  createdByUserId?: string | null;
  /** Platform docs only: restrict to these partner orgs; empty = all partners. */
  allowedOrganizationIds?: string[];
};

export async function createDocument(prisma: PrismaClient, input: CreateDocumentInput) {
  await prisma.documentCategory.findUniqueOrThrow({ where: { id: input.categoryId } });
  const orgIds = input.allowedOrganizationIds ?? [];
  const isPlatform = (input.organizationId ?? null) == null;
  if (isPlatform && orgIds.length > 0) {
    await assertPartnerOrgIds(prisma, orgIds);
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.document.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        categoryId: input.categoryId,
        fileUrl: input.fileUrl,
        visibility: input.visibility ?? "partners_only",
        countryScope: input.countryScope ?? null,
        documentType: input.documentType ?? null,
        projectId: input.projectId ?? null,
        engineeringRequestId: input.engineeringRequestId ?? null,
        organizationId: input.organizationId ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
    if (isPlatform && orgIds.length > 0) {
      await tx.documentAllowedOrganization.createMany({
        data: orgIds.map((organizationId) => ({
          documentId: row.id,
          organizationId,
        })),
      });
    }
    return tx.document.findUniqueOrThrow({
      where: { id: row.id },
      include: documentListInclude,
    });
  });
}

export type UpdateDocumentInput = {
  title?: string;
  description?: string | null;
  categoryId?: string;
  fileUrl?: string;
  visibility?: "public" | "partners_only" | "internal";
  countryScope?: string | null;
  /** Platform docs only: replace allowlist; omit to leave unchanged; [] = all partners. */
  allowedOrganizationIds?: string[];
};

export async function updateDocument(
  prisma: PrismaClient,
  documentId: string,
  data: UpdateDocumentInput
) {
  const { allowedOrganizationIds, ...patch } = data;

  return prisma.$transaction(async (tx) => {
    if (allowedOrganizationIds !== undefined) {
      const existing = await tx.document.findUnique({
        where: { id: documentId },
        select: { organizationId: true },
      });
      if (existing?.organizationId == null) {
        await assertPartnerOrgIds(tx, allowedOrganizationIds);
        await tx.documentAllowedOrganization.deleteMany({ where: { documentId } });
        if (allowedOrganizationIds.length > 0) {
          await tx.documentAllowedOrganization.createMany({
            data: allowedOrganizationIds.map((organizationId) => ({
              documentId,
              organizationId,
            })),
          });
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (patch.title != null) updateData.title = patch.title;
    if (patch.description !== undefined) updateData.description = patch.description;
    if (patch.categoryId != null) updateData.categoryId = patch.categoryId;
    if (patch.fileUrl != null) updateData.fileUrl = patch.fileUrl;
    if (patch.visibility != null) updateData.visibility = patch.visibility;
    if (patch.countryScope !== undefined) updateData.countryScope = patch.countryScope;

    if (Object.keys(updateData).length > 0) {
      return tx.document.update({
        where: { id: documentId },
        data: updateData as Prisma.DocumentUpdateInput,
        include: documentListInclude,
      });
    }
    return tx.document.findUniqueOrThrow({
      where: { id: documentId },
      include: documentListInclude,
    });
  });
}
