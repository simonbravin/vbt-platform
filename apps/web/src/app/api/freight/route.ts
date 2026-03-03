import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  countryId: z.string().min(1),
  name: z.string().min(1),
  freightPerContainer: z.number().min(0),
  isDefault: z.boolean().default(false),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const countryId = url.searchParams.get("countryId") ?? "";

  const profiles = await prisma.freightRateProfile.findMany({
    where: { orgId: user.orgId, ...(countryId ? { countryId } : {}) },
    include: { country: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(profiles);
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

  const profile = await prisma.freightRateProfile.create({
    data: { ...parsed.data, orgId: user.orgId },
  });
  return NextResponse.json(profile, { status: 201 });
}
