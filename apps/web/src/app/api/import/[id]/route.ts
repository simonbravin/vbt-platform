import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const revitImport = await prisma.revitImport.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: {
      lines: {
        include: {
          piece: {
            include: {
              costs: { orderBy: { effectiveFrom: "desc" }, take: 1 },
              system: true,
            },
          },
        },
        orderBy: { rowNum: "asc" },
      },
    },
  });

  if (!revitImport) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  return NextResponse.json(revitImport);
}
