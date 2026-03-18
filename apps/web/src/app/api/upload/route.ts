import { NextResponse } from "next/server";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { uploadToR2 } from "@/lib/r2-client";
import { checkRateLimit, getRateLimitIdentifier, RateLimitExceededError } from "@/lib/rate-limit";
import { randomUUID } from "crypto";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

/** POST: upload a file (multipart form field "file"). Returns { url, fileName } where url is the R2 storage key for use in engineering files / documents.
 *  Path is org-scoped: {organizationId}/engineering/{engineeringRequestId?}/{uuid}_{filename}
 *  Requires R2 env vars (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).
 */
export async function POST(req: Request) {
  try {
    await checkRateLimit(getRateLimitIdentifier(req), "create_update");
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    throw e;
  }
  let user;
  try {
    user = await requireActiveOrg();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = user.activeOrgId ?? null;
  if (!organizationId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file. Send as form field 'file'." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)} MB)` },
      { status: 400 }
    );
  }

  const engineeringRequestId = (formData.get("engineeringRequestId") as string)?.trim() || null;
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const base = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
  const uniqueId = randomUUID();
  const filename = `${uniqueId}_${base}${ext}`;
  const storageKey = engineeringRequestId
    ? `${organizationId}/engineering/${engineeringRequestId}/${filename}`
    : `${organizationId}/uploads/${filename}`;

  try {
    await uploadToR2(file, storageKey);
    return NextResponse.json({ url: storageKey, fileName: file.name });
  } catch (err) {
    console.error("[api/upload]", err);
    return NextResponse.json(
      {
        error:
          process.env.R2_BUCKET_NAME ? "Upload failed" : "Storage not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)",
      },
      { status: process.env.R2_BUCKET_NAME ? 500 : 503 }
    );
  }
}
