import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';
import { withRetry } from './retry';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'gramcarbon-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/mpeg'];

interface FileValidation {
  ok: boolean;
  error?: string;
}

export function validateFile(buffer: Buffer, mimeType: string): FileValidation {
  if (buffer.length > MAX_FILE_SIZE) {
    return { ok: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { ok: false, error: `File type ${mimeType} is not allowed` };
  }
  return { ok: true };
}

export async function uploadToS3(buffer: Buffer, mimeType: string, folder = 'uploads'): Promise<{ key: string; url: string }> {
  const ext = mimeType.split('/')[1] || 'bin';
  const key = `${folder}/${uuidv4()}.${ext}`;

  await withRetry(
    () => s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: mimeType })),
    { retries: 3, delayMs: 500, label: `S3 upload (${key})` }
  );

  return { key, url: `https://${BUCKET}.s3.amazonaws.com/${key}` };
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export async function deleteFromS3(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    logger.error('S3 delete failed', { key, err: err instanceof Error ? err.message : String(err) });
  }
}
