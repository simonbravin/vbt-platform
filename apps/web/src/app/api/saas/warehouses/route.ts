import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const organizationIdParam = url.searchParams.get("organizationId");
    let organizationId: string | null = null;
    if (ctx.isPlatformSuperadmin && organizationIdParam) {
      organizationId = organizationIdParam;
    } else if (ctx.activeOrgId) {
      organizationId = ctx.activeOrgId;
    }
    if (!organizationId) {
      return NextResponse.json({ warehouses: [] });
    }
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ warehouses });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("[api/saas/warehouses GET]", e);
    return NextResponse.json({ warehouses: [] });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() || null : null;
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim() || null : null;
    const address = typeof body.address === "string" ? body.address.trim() || null : null;
    const managerName = typeof body.managerName === "string" ? body.managerName.trim() || null : null;
    const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() || null : null;
    const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() || null : null;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    let organizationId: string | null = null;
    if (ctx.isPlatformSuperadmin && body.organizationId) {
      organizationId = body.organizationId;
    } else if (ctx.activeOrgId) {
      organizationId = ctx.activeOrgId;
    }
    if (!organizationId) {
      return NextResponse.json({ error: "No organization context" }, { status: 400 });
    }
    const fullData = { organizationId, name, location, countryCode, address, managerName, contactPhone, contactEmail };
    let warehouse: Awaited<ReturnType<typeof prisma.warehouse.create>>;
    try {
      warehouse = await prisma.warehouse.create({ data: fullData });
    } catch (createErr) {
      const err = createErr as Error & { code?: string };
      const isSchemaError = err?.code === "P2011" || /column|Unknown column/i.test(String(err?.message ?? ""));
      if (isSchemaError) {
        try {
          warehouse = await prisma.warehouse.create({
            data: { organizationId, name, location },
          });
          if (warehouse && (countryCode ?? address ?? managerName ?? contactPhone ?? contactEmail)) {
            await prisma.warehouse.update({
              where: { id: warehouse.id },
              data: {
                ...(countryCode != null && { countryCode }),
                ...(address != null && { address }),
                ...(managerName != null && { managerName }),
                ...(contactPhone != null && { contactPhone }),
                ...(contactEmail != null && { contactEmail }),
              },
            }).then(() => {
              return prisma.warehouse.findUnique({ where: { id: warehouse!.id } });
            }).then((updated) => {
              if (updated) warehouse = updated;
            }).catch(() => {});
          }
        } catch (fallbackErr) {
          console.error("[api/saas/warehouses POST]", fallbackErr);
          return NextResponse.json(
            { error: "Database schema may be outdated. Run migrations (prisma migrate deploy) with the production DATABASE_URL." },
            { status: 500 }
          );
        }
      } else {
        throw createErr;
      }
    }
    return NextResponse.json(warehouse);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    const err = e as Error & { code?: string };
    console.error("[api/saas/warehouses POST]", err);
    const message = err?.code === "P2011" || err?.message?.includes("column") || err?.message?.includes("Unknown column")
      ? "Database schema may be outdated. Run migrations (prisma migrate deploy) with the production DATABASE_URL."
      : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
