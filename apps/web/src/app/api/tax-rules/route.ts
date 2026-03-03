import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const taxRuleSchema = z.object({
  order: z.number(),
  label: z.string().min(1),
  base: z.enum(["CIF", "FOB", "BASE_IMPONIBLE", "FIXED_PER_CONTAINER", "FIXED_TOTAL"]),
  ratePct: z.number().optional(),
  fixedAmount: z.number().optional(),
  perContainer: z.boolean().optional().default(false),
  note: z.string().optional(),
});

const createSchema = z.object({
  countryId: z.string().min(1),
  name: z.string().min(1),
  rules: z.array(taxRuleSchema),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const countryId = url.searchParams.get("countryId") ?? "";

  const sets = await prisma.taxRuleSet.findMany({
    where: {
      orgId: user.orgId,
      isActive: true,
      ...(countryId ? { countryId } : {}),
    },
    include: { country: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(sets);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const set = await prisma.taxRuleSet.create({
    data: { ...parsed.data, orgId: user.orgId, rules: parsed.data.rules as any },
  });

  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "TAX_RULE_CHANGED",
    entityType: "TaxRuleSet",
    entityId: set.id,
    meta: { name: set.name, action: "created" },
  });

  return NextResponse.json(set, { status: 201 });
}
