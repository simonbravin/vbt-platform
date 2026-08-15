import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { assertPartnerModuleEnabled } from "@/lib/module-access";
import {
  addEngineeringFile,
  addEngineeringReviewEvent,
  createDocument,
  isEngineeringStatusAllowingPartnerUpload,
  serializeEngineeringTimelineEvent,
} from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
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
    await assertPartnerModuleEnabled("engineering", user);
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    if (user.isPlatformSuperadmin && !user.activeOrgId) {
      return NextResponse.json(
        { error: "platform_use_revision_upload", message: "Use engineering revision upload for platform files." },
        { status: 403 }
      );
    }

    const partnerOrgId = user.activeOrgId;
    if (!partnerOrgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: partnerOrgId,
      isPlatformSuperadmin: false,
    };

    const erCheck = await prisma.engineeringRequest.findFirst({
      where: { id: params.id, organizationId: partnerOrgId },
      select: { status: true },
    });
    if (!erCheck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!isEngineeringStatusAllowingPartnerUpload(erCheck.status)) {
      return NextResponse.json(
        { error: "partner_upload_forbidden_status", message: "Files cannot be added in the current status." },
        { status: 403 }
      );
    }

    const file = await addEngineeringFile(prisma, tenantCtx, params.id, {
      fileName: parsed.data.fileName,
      fileType: parsed.data.fileType ?? null,
      fileSize: parsed.data.fileSize ?? null,
      fileUrl: parsed.data.fileUrl,
    });

    try {
      await addEngineeringReviewEvent(prisma, tenantCtx, params.id, {
        body: serializeEngineeringTimelineEvent({
          k: "partner_file",
          fileName: parsed.data.fileName,
        }),
        visibility: "partner",
      });
    } catch (e) {
      console.error("[engineering files POST] timeline event", e);
    }

    const request = await prisma.engineeringRequest.findUnique({
      where: { id: params.id },
      select: { projectId: true },
    });
    if (request?.projectId) {
      try {
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
          organizationId: partnerOrgId,
          createdByUserId: user.userId ?? user.id,
        });
      } catch (docErr) {
        console.error("[engineering files POST] createDocument", docErr);
      }
    }

    await createActivityLog({
      organizationId: partnerOrgId,
      userId: user.userId ?? user.id,
      action: "engineering_partner_file_uploaded",
      entityType: "engineering_request",
      entityId: params.id,
      metadata: { fileName: parsed.data.fileName },
    });

    return NextResponse.json(file, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}
