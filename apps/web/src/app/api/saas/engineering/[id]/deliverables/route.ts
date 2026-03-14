import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { addDeliverable } from "@vbt/core";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  fileUrl: z.string().min(1),
});

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
    const deliverable = await addDeliverable(prisma, tenantCtx, params.id, {
      title: parsed.data.title ?? null,
      description: parsed.data.description ?? null,
      fileUrl: parsed.data.fileUrl,
    });
    return NextResponse.json(deliverable, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}
