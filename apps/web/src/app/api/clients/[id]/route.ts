import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  countryId: z.string().nullable().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
}).partial();

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: {
      country: { select: { id: true, name: true, code: true } },
      _count: { select: { projects: true } },
      projects: { select: { id: true, name: true, status: true }, orderBy: { updatedAt: "desc" }, take: 20 },
    },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.client.findFirst({
    where: { id: params.id, orgId: user.orgId },
  });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = { ...parsed.data } as Record<string, unknown>;
  if (data.countryId === "" || data.countryId === null) data.countryId = null;

  const client = await prisma.client.update({
    where: { id: params.id },
    data: data as any,
    include: { country: { select: { id: true, name: true, code: true } }, _count: { select: { projects: true } } },
  });
  return NextResponse.json(client);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: { _count: { select: { projects: true } } },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client._count.projects > 0) {
    return NextResponse.json(
      { error: "Cannot delete client with linked projects. Unlink projects first." },
      { status: 400 }
    );
  }

  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
