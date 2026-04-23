import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function getR2PublicBaseUrl() {
  return requireEnv('CLOUDFLARE_R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
}

export function getR2BucketName() {
  return requireEnv('CLOUDFLARE_R2_BUCKET');
}

export function getR2Client() {
  const accountId = requireEnv('CLOUDFLARE_R2_ACCOUNT_ID');
  const accessKeyId = requireEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function putR2Object(params: {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}) {
  const client = getR2Client();
  const bucket = getR2BucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl || 'public, max-age=31536000, immutable',
    }),
  );

  const base = getR2PublicBaseUrl();
  return { url: `${base}/${params.key}` };
}

