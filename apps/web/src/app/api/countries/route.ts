import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().length(2).toUpperCase(),
  name: z.string().min(1),
  currency: z.string().default("USD"),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const countries = await prisma.countryProfile.findMany({
    where: { orgId: user.orgId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(countries);
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const country = await prisma.countryProfile.create({
    data: { ...parsed.data, orgId: user.orgId },
  });
  return NextResponse.json(country, { status: 201 });
}
