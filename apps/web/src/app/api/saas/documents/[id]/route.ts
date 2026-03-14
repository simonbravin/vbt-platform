import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg } from "@/lib/tenant";
import { getDocumentById, updateDocument } from "@vbt/core";
import { z } from "zod";

const VISIBILITY = ["public", "partners_only", "internal"] as const;

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().min(1).optional(),
  fileUrl: z.string().min(1).optional(),
  visibility: z.enum(VISIBILITY).optional(),
  countryScope: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const doc = await getDocumentById(prisma, params.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireActiveOrg();
    const existing = await getDocumentById(prisma, params.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const doc = await updateDocument(prisma, params.id, parsed.data);
    return NextResponse.json(doc);
  } catch (e) {
    throw e;
  }
}
