import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const settingsSchema = z.object({
  baseUom: z.enum(["M", "FT"]).optional(),
  weightUom: z.enum(["KG", "LBS"]).optional(),
  minRunFt: z.number().positive().optional(),
  rateS80: z.number().min(0).optional(),
  rateS150: z.number().min(0).optional(),
  rateS200: z.number().min(0).optional(),
  rateGlobal: z.number().min(0).optional(),
  commissionPct: z.number().min(0).optional(),
  commissionFixed: z.number().min(0).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const orgId = user.activeOrgId ?? user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const org = await prisma.organization.findFirst({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  return NextResponse.json(org);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const orgId = user.activeOrgId ?? user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (parsed.data.baseUom != null) data.baseUom = parsed.data.baseUom;
  if (parsed.data.weightUom != null) data.weightUom = parsed.data.weightUom;
  if (parsed.data.minRunFt != null) data.minRunFt = parsed.data.minRunFt;
  if (parsed.data.rateS80 != null) data.rateS80 = parsed.data.rateS80;
  if (parsed.data.rateS150 != null) data.rateS150 = parsed.data.rateS150;
  if (parsed.data.rateS200 != null) data.rateS200 = parsed.data.rateS200;
  if (parsed.data.rateGlobal != null) data.rateGlobal = parsed.data.rateGlobal;
  if (parsed.data.commissionPct != null) data.commissionPct = parsed.data.commissionPct;
  if (parsed.data.commissionFixed != null) data.commissionFixed = parsed.data.commissionFixed;
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: Object.keys(data).length ? (data as any) : undefined,
  });

  return NextResponse.json(updated);
}
