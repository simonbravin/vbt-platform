import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Public: get invite details by token for the accept-invite form. Returns 404 if invalid/expired/used. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token?.trim()) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const invite = await prisma.partnerInvite.findFirst({
    where: {
      token: token.trim(),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      organization: { select: { name: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  const roleLabel = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);
  return NextResponse.json({
    partnerName: invite.organization.name,
    email: invite.email,
    role: roleLabel,
  });
}
