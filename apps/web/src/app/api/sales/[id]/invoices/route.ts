import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saleOrganizationIdIfReadable, salesUserCanMutate } from "@/lib/sales-access";
import { z } from "zod";
import { refreshSaleComputedStatus } from "@/lib/partner-sales";

const postSchema = z.object({
  entityId: z.string().min(1),
  amountUsd: z.number().min(0),
  dueDate: z.string().optional().nullable(),
  sequence: z.number().int().min(1).optional(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: saleId } = params instanceof Promise ? await params : params;
  const organizationId = await saleOrganizationIdIfReadable(user, saleId);
  if (!organizationId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, organizationId },
    include: { _count: { select: { payments: true } } },
  });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sale._count.payments > 0) {
    return NextResponse.json({ error: "Cannot add invoices when payments exist" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;

  const ent = await prisma.billingEntity.findFirst({
    where: { id: data.entityId, organizationId, isActive: true },
  });
  if (!ent) return NextResponse.json({ error: "Invalid billing entity" }, { status: 400 });

  await prisma.saleInvoice.create({
    data: {
      saleId,
      billingEntityId: data.entityId,
      amountUsd: data.amountUsd,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      sequence: data.sequence ?? 1,
      referenceNumber: data.referenceNumber ?? null,
      notes: data.notes ?? null,
    },
  });
  await refreshSaleComputedStatus(saleId);
  return NextResponse.json({ ok: true });
}
