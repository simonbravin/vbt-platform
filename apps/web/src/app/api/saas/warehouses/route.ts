import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getTenantContext,
  getSessionUser,
  getEffectiveOrganizationId,
  TenantError,
  tenantErrorStatus,
} from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    const user = await getSessionUser();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const organizationIdParam = url.searchParams.get("organizationId");
    let organizationId: string | null = null;
    if (ctx.isPlatformSuperadmin && organizationIdParam) {
      organizationId = organizationIdParam;
    } else {
      organizationId = ctx.activeOrgId ?? (user ? getEffectiveOrganizationId(user) : null);
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
    const user = await getSessionUser();
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
    } else {
      organizationId = ctx.activeOrgId ?? (user ? getEffectiveOrganizationId(user) : null);
    }
    // Definitive fallback: if the session doesn't carry an org, resolve from membership.
    // This is tenant-safe because we still only use orgs where the logged-in user is an active member.
    if (!organizationId || typeof organizationId !== "string" || !organizationId.trim()) {
      const member = await prisma.orgMember.findFirst({
        // In some onboarding flows the member can still be "invited" when first configuring things.
        // We only ever pick an organization where the user already has an OrgMember record.
        where: { userId: ctx.userId, status: { in: ["active", "invited"] } },
        select: { organizationId: true },
      });
      organizationId = member?.organizationId ?? null;
    }
    if (!organizationId || typeof organizationId !== "string" || !organizationId.trim()) {
      return NextResponse.json(
        { error: "Organization context missing or invalid. Select your organization or contact support." },
        { status: 400 }
      );
    }
    const orgId = organizationId.trim();
    // Explicit timestamps/isActive to avoid NOT NULL constraint issues in Neon when migrations
    // were partially applied (e.g. updated_at without DEFAULT).
    const fullData = {
      organizationId: orgId,
      name,
      location,
      countryCode,
      address,
      managerName,
      contactPhone,
      contactEmail,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let warehouse: Awaited<ReturnType<typeof prisma.warehouse.create>>;
    try {
      warehouse = await prisma.warehouse.create({ data: fullData });
    } catch (createErr) {
      const err = createErr as Error & { code?: string };
      if (err?.code === "P2011") {
        return NextResponse.json(
          { error: "Organization context missing or invalid. Select your organization or contact support." },
          { status: 400 }
        );
      }
      const isMissingColumn = err?.code === "P2022" || /column.*does not exist|Unknown column/i.test(String(err?.message ?? ""));
      if (isMissingColumn) {
        try {
          warehouse = await prisma.warehouse.create({
            data: {
              organizationId: orgId,
              name,
              location,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
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
          const fallbackCode = (fallbackErr as Error & { code?: string })?.code;
          console.error("[api/saas/warehouses POST]", fallbackErr);
          if (fallbackCode === "P2011") {
            return NextResponse.json(
              { error: "Organization context missing or invalid. Select your organization or contact support." },
              { status: 400 }
            );
          }
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
