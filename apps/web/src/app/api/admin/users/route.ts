import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { role?: string; isPlatformSuperadmin?: boolean };
    const canAccess = ["SUPERADMIN", "ADMIN"].includes(user.role ?? "") || user.isPlatformSuperadmin === true;
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        isPlatformSuperadmin: true,
        createdAt: true,
        orgMembers: {
          where: { status: "active" },
          select: {
            role: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const list = users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      name: u.fullName ?? u.email,
      status: u.isActive === true ? "ACTIVE" : "PENDING",
      isPlatformSuperadmin: u.isPlatformSuperadmin ?? false,
      createdAt: u.createdAt,
      orgMembers: u.orgMembers,
    }));
    return NextResponse.json(list);
  } catch (e) {
    console.error("GET /api/admin/users error:", e);
    return NextResponse.json([], { status: 200 });
  }
}
