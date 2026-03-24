import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { markSessionAttendance, getSessionEnrollmentById } from "@vbt/core";
import { sessionAttendanceSchema } from "@vbt/core/validation";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = sessionAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const existing = await getSessionEnrollmentById(prisma, params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollment = await markSessionAttendance(prisma, params.id, {
    status: parsed.data.status,
    markedByUserId: user.userId ?? user.id,
  });
  return NextResponse.json(enrollment);
}
