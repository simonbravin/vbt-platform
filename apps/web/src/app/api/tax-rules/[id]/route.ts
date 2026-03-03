import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const set = await prisma.taxRuleSet.findUnique({ where: { id: params.id }, include: { country: true } });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(set);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const set = await prisma.taxRuleSet.update({
    where: { id: params.id },
    data: {
      ...body,
      rules: body.rules ?? undefined,
    },
  });
  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "TAX_RULE_CHANGED",
    entityType: "TaxRuleSet",
    entityId: params.id,
    meta: { action: "updated" },
  });
  return NextResponse.json(set);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.taxRuleSet.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
