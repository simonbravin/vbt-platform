import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { addEngineeringFile, createDocument } from "@vbt/core";
import { z } from "zod";

const bodySchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().nullable().optional(),
  fileSize: z.number().int().min(0).nullable().optional(),
  fileUrl: z.string().min(1), // storageUrl
});

const ENG_CATEGORY_CODE = "ENG";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireActiveOrg();
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin,
    };
    const file = await addEngineeringFile(prisma, tenantCtx, params.id, {
      fileName: parsed.data.fileName,
      fileType: parsed.data.fileType ?? null,
      fileSize: parsed.data.fileSize ?? null,
      fileUrl: parsed.data.fileUrl,
    });

    const request = await prisma.engineeringRequest.findUnique({
      where: { id: params.id },
      select: { projectId: true },
    });
    if (request?.projectId) {
      let engCategory = await prisma.documentCategory.findUnique({
        where: { code: ENG_CATEGORY_CODE },
      });
      if (!engCategory) {
        engCategory = await prisma.documentCategory.create({
          data: { name: "Solicitudes de ingeniería", code: ENG_CATEGORY_CODE, sortOrder: 100 },
        });
      }
      await createDocument(prisma, {
        title: parsed.data.fileName,
        categoryId: engCategory.id,
        fileUrl: parsed.data.fileUrl,
        visibility: "partners_only",
        projectId: request.projectId,
        engineeringRequestId: params.id,
        organizationId: user.activeOrgId ?? null,
        createdByUserId: user.userId ?? user.id,
      });
    }

    return NextResponse.json(file, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}
