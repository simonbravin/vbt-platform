import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { role?: string; isPlatformSuperadmin?: boolean };
  const canAccess = ["SUPERADMIN", "ADMIN"].includes(user.role ?? "") || user.isPlatformSuperadmin === true;
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      orgMembers: {
        include: { organization: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      name: (u as { fullName?: string }).fullName ?? u.email,
      status: (u as { isActive?: boolean }).isActive === true ? "ACTIVE" : "PENDING",
    }))
  );
}
