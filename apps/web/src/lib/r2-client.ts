import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const isR2Configured =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME;

export const r2Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

/** Upload file to R2. Key = storage path (e.g. orgId/engineering/reqId/uuid_name.pdf). */
export async function uploadToR2(file: File, key: string): Promise<void> {
  if (!r2Client || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)");
  }
  const buffer = await file.arrayBuffer();
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: file.type || "application/octet-stream",
    })
  );
}

/** Get a signed download URL for the given storage key (1h expiry). */
export async function getDownloadUrl(storageKey: string): Promise<string> {
  if (!r2Client || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 not configured");
  }
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: storageKey,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

export function isR2StorageKey(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return !value.startsWith("http://") && !value.startsWith("https://");
}
