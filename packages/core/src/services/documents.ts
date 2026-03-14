import type { PrismaClient, Document, DocumentCategory } from "@vbt/db";

/**
 * Document library is platform-wide (no organizationId on documents).
 * Filtering is by visibility and optional countryScope.
 */
export type ListDocumentsOptions = {
  categoryId?: string;
  categoryCode?: string;
  visibility?: "public" | "partners_only" | "internal";
  countryScope?: string; // e.g. "PA" or "*"
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

export async function listDocuments(
  prisma: PrismaClient,
  options: ListDocumentsOptions = {}
): Promise<{ documents: Document[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (options.categoryId) where.categoryId = options.categoryId;
  if (options.categoryCode) {
    const cat = await prisma.documentCategory.findUnique({
      where: { code: options.categoryCode },
    });
    if (cat) where.categoryId = cat.id;
  }
  if (options.visibility) where.visibility = options.visibility;
  if (options.countryScope) {
    where.OR = [
      { countryScope: options.countryScope },
      { countryScope: "*" },
      { countryScope: null },
    ];
  }
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { category: { select: { id: true, name: true, code: true } } },
      orderBy: [{ categoryId: "asc" }, { title: "asc" }],
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    }),
    prisma.document.count({ where }),
  ]);
  return { documents, total };
}

export async function getDocumentById(
  prisma: PrismaClient,
  documentId: string
): Promise<Document | null> {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: { category: true },
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
  createdByUserId?: string | null;
};

export async function createDocument(
  prisma: PrismaClient,
  input: CreateDocumentInput
): Promise<Document> {
  await prisma.documentCategory.findUniqueOrThrow({ where: { id: input.categoryId } });
  return prisma.document.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      categoryId: input.categoryId,
      fileUrl: input.fileUrl,
      visibility: input.visibility ?? "partners_only",
      countryScope: input.countryScope ?? null,
      documentType: input.documentType ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
    include: { category: { select: { id: true, name: true, code: true } } },
  });
}

export type UpdateDocumentInput = {
  title?: string;
  description?: string | null;
  categoryId?: string;
  fileUrl?: string;
  visibility?: "public" | "partners_only" | "internal";
  countryScope?: string | null;
};

export async function updateDocument(
  prisma: PrismaClient,
  documentId: string,
  data: UpdateDocumentInput
): Promise<Document> {
  return prisma.document.update({
    where: { id: documentId },
    data: {
      ...(data.title != null && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.categoryId != null && { categoryId: data.categoryId }),
      ...(data.fileUrl != null && { fileUrl: data.fileUrl }),
      ...(data.visibility != null && { visibility: data.visibility }),
      ...(data.countryScope !== undefined && { countryScope: data.countryScope }),
    },
    include: { category: { select: { id: true, name: true, code: true } } },
  });
}
