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

  const org = await prisma.org.findFirst({ where: { id: user.orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

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

  const updated = await prisma.org.update({
    where: { id: user.orgId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
