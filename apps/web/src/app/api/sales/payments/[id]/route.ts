import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { paymentRecordIfMutable, salesUserCanMutate } from "@/lib/sales-access";
import { refreshSaleComputedStatus } from "@/lib/partner-sales";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: paymentId } = params instanceof Promise ? await params : params;
  const payment = await paymentRecordIfMutable(user, paymentId);
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.payment.delete({ where: { id: paymentId } });
  await refreshSaleComputedStatus(payment.saleId);
  return NextResponse.json({ ok: true });
}
