import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { listProjects, createProject } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectCode: z.string().optional(),
  clientId: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
  city: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["lead", "qualified", "quoting", "engineering", "won", "lost", "on_hold"]).optional(),
  estimatedTotalAreaM2: z.number().min(0).optional().nullable(),
  estimatedWallAreaM2: z.number().min(0).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "50");
    const search = url.searchParams.get("search") ?? "";
    const statusParam = url.searchParams.get("status");
    const clientIdParam = url.searchParams.get("clientId");

    const tenantCtx = {
      userId: ctx!.userId,
      organizationId: ctx!.activeOrgId,
      isPlatformSuperadmin: ctx!.isPlatformSuperadmin ?? false,
    };
    const result = await listProjects(prisma, tenantCtx, {
      search: search.trim() || undefined,
      status: statusParam as any,
      clientId: clientIdParam ?? undefined,
      limit,
      offset: (page - 1) * limit,
    });

    return NextResponse.json({
      projects: result.projects,
      total: result.total,
      page,
      limit,
    });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireActiveOrg();
    if (["viewer"].includes((user.role as string)?.toLowerCase?.())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
    };
    const project = await createProject(prisma, tenantCtx, {
      projectName: parsed.data.projectName,
      projectCode: parsed.data.projectCode ?? undefined,
      clientId: parsed.data.clientId ?? undefined,
      countryCode: parsed.data.countryCode ?? undefined,
      city: parsed.data.city ?? undefined,
      address: parsed.data.address ?? undefined,
      description: parsed.data.description ?? undefined,
      status: parsed.data.status ?? undefined,
      estimatedTotalAreaM2: parsed.data.estimatedTotalAreaM2 ?? undefined,
      estimatedWallAreaM2: parsed.data.estimatedWallAreaM2 ?? undefined,
    });

    await createActivityLog({
      organizationId: user.activeOrgId ?? undefined,
      userId: user.id,
      action: "PROJECT_CREATED",
      entityType: "Project",
      entityId: project.id,
      metadata: {},
    });

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message.includes("Client does not belong")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
