// S3 attachment support: presigned PUT (upload) and presigned GET (download) URLs.
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  s3,
  env,
  json,
  badRequest,
  uuid,
  sanitizeFileName,
  testHooks,
} from "./lib.mjs";
import { getTicketRecord, assertTicketAccess } from "./tickets.mjs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB cap per the POC brief
const URL_EXPIRY_SECONDS = 900; // 15 minutes

export async function presignPutUrl(key, contentType) {
  if (testHooks.signPut) return testHooks.signPut(key, contentType);
  const cmd = new PutObjectCommand({
    Bucket: env().attachmentsBucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: URL_EXPIRY_SECONDS });
}

export async function presignGetUrl(key) {
  if (testHooks.signGet) return testHooks.signGet(key);
  const cmd = new GetObjectCommand({
    Bucket: env().attachmentsBucket,
    Key: key,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: URL_EXPIRY_SECONDS });
}

// POST /tickets/presigned-url
// Body: { ticketId?, fileName*, contentType*, size? }
export async function presignedUrl(event, claims, body) {
  const { ticketId, fileName, contentType, size } = body || {};
  if (!fileName || !contentType) {
    return badRequest("fileName and contentType are required");
  }
  if (size != null && Number(size) > MAX_UPLOAD_BYTES) {
    return badRequest("File size must not exceed 10MB");
  }
  if (ticketId) {
    const ticket = await getTicketRecord(ticketId);
    const denied = assertTicketAccess(ticket, claims);
    if (denied) return denied;
  }
  const safeName = sanitizeFileName(fileName);
  const key = `attachments/${ticketId || "unassigned"}/${uuid()}-${safeName}`;
  const uploadUrl = await presignPutUrl(key, contentType);
  return json(200, {
    uploadUrl,
    key,
    fileName: safeName,
    expiresIn: URL_EXPIRY_SECONDS,
  });
}
