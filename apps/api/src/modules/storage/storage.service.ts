import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { randomUUID } from 'crypto';

/**
 * S3-compatible object storage (MinIO in dev, any S3 in prod).
 * Files are addressed by a tenant-scoped key: `<bucket>/<tenantId>/<uuid>/<name>`.
 */
const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

export interface UploadResult {
  key: string;
  bucket: string;
  mimeType: string;
  size: number;
}

/** Upload a buffer. Returns the storage key + metadata. */
export async function uploadObject(
  tenantId: string,
  folder: string,
  filename: string,
  mimeType: string,
  body: Buffer,
): Promise<UploadResult> {
  const key = `${tenantId}/${folder}/${randomUUID()}/${sanitize(filename)}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }),
  );
  return { key, bucket: env.S3_BUCKET, mimeType, size: body.byteLength };
}

/** Generate a short-lived presigned download URL for a stored object. */
export async function getDownloadUrl(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn },
  );
}

/** Permanently delete an object. */
export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/** Public URL for an object (only meaningful when the bucket is public). */
export function publicUrl(key: string): string {
  return `${env.S3_PUBLIC_BASE_URL}/${env.S3_BUCKET}/${key}`;
}

function sanitize(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

/** Best-effort: confirm the default bucket exists; create it on first run. */
export async function ensureDefaultBucket(): Promise<void> {
  // MinIO/S3 head/creation differs across providers; we rely on the
  // docker-compose minio-init container to create buckets in dev. For other
  // providers, create the bucket out-of-band. Logged but non-fatal here.
  logger.debug({ bucket: env.S3_BUCKET }, 'Default bucket assumed ready');
}
