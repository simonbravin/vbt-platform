import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getProjectById, updateProject } from "@vbt/core";
import { z } from "zod";

const updateSchema = z.object({
  projectName: z.string().min(1).optional(),
  projectCode: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
  city: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["lead", "qualified", "quoting", "engineering", "won", "lost", "on_hold"]).optional(),
  description: z.string().optional(),
}).partial();

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantCtx = { userId: ctx.userId, organizationId: ctx.activeOrgId, isPlatformSuperadmin: ctx.isPlatformSuperadmin };
    const project = await getProjectById(prisma, tenantCtx, params.id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireActiveOrg();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin,
    };
    const project = await updateProject(prisma, tenantCtx, params.id, parsed.data);
    return NextResponse.json(project);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}
