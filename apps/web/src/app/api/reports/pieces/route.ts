import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "15"), 50);
  const projectStatus = url.searchParams.get("projectStatus") ?? "SOLD"; // SOLD or all (empty = all)

  const projectsWhere: Record<string, unknown> = { orgId: user.orgId, baselineQuoteId: { not: null } };
  if (projectStatus === "SOLD") {
    projectsWhere.status = "SOLD";
  }

  const projectsWithBaseline = await prisma.project.findMany({
    where: projectsWhere,
    select: { baselineQuoteId: true },
  });
  const quoteIds = projectsWithBaseline.map((p) => p.baselineQuoteId).filter(Boolean) as string[];
  if (quoteIds.length === 0) {
    return NextResponse.json({
      byQty: [],
      byKg: [],
      byM2: [],
    });
  }

  const lines = await prisma.quoteLine.findMany({
    where: { quoteId: { in: quoteIds }, pieceId: { not: null } },
    include: { quote: { select: { projectId: true } } },
  });

  const pieceAgg: Record<
    string,
    { pieceId: string; description: string; systemCode: string | null; qty: number; kg: number; m2: number }
  > = {};
  for (const line of lines) {
    const id = line.pieceId!;
    if (!pieceAgg[id]) {
      pieceAgg[id] = {
        pieceId: id,
        description: line.description,
        systemCode: line.systemCode,
        qty: 0,
        kg: 0,
        m2: 0,
      };
    }
    pieceAgg[id].qty += Number(line.qty) || 0;
    pieceAgg[id].kg += Number(line.weightKgCored) || 0;
    pieceAgg[id].m2 += Number(line.m2Line) || 0;
  }

  const arr = Object.values(pieceAgg);
  const byQty = [...arr].sort((a, b) => b.qty - a.qty).slice(0, limit);
  const byKg = [...arr].sort((a, b) => b.kg - a.kg).slice(0, limit);
  const byM2 = [...arr].sort((a, b) => b.m2 - a.m2).slice(0, limit);

  return NextResponse.json({ byQty, byKg, byM2 });
}
