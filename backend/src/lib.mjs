// Shared helpers for the ticketing Lambda: responses, auth claims, clients.
//
// The DynamoDB/S3 clients and presigners are resolved lazily through
// `testHooks` so that test/run.mjs can swap in in-memory fakes without
// touching production code paths.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

export const testHooks = { ddb: null, s3: null, signPut: null, signGet: null };

let _ddb = null;
let _s3 = null;

export function ddb() {
  if (testHooks.ddb) return testHooks.ddb;
  if (!_ddb) {
    _ddb = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
    );
  }
  return _ddb;
}

export function s3() {
  if (testHooks.s3) return testHooks.s3;
  if (!_s3) _s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  return _s3;
}

export function env() {
  return {
    ticketsTable: process.env.TICKETS_TABLE,
    commentsTable: process.env.COMMENTS_TABLE,
    attachmentsBucket: process.env.ATTACHMENTS_BUCKET,
  };
}

// ---- HTTP responses (API Gateway HTTP API v2 proxy format) ----

export const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const badRequest = (message) => json(400, { message });
export const unauthorized = (message = "Unauthorized") => json(401, { message });
export const forbidden = (message = "Forbidden") => json(403, { message });
export const notFound = (message = "Not found") => json(404, { message });
export const serverError = (message = "Internal server error") =>
  json(500, { message });

// ---- Auth (claims come from the API Gateway JWT authorizer) ----

export function getClaims(event) {
  return event?.requestContext?.authorizer?.jwt?.claims || {};
}

export function getUserId(claims) {
  return claims.sub;
}

export function getEmail(claims) {
  return claims.email || "";
}

// Role rule for this POC: membership in the Cognito "Agents" group => agent,
// everyone else is a customer.
export function getRole(claims) {
  const groups = claims["cognito:groups"] || [];
  return groups.includes("Agents") ? "agent" : "customer";
}

export function isAgent(claims) {
  return getRole(claims) === "agent";
}

// ---- Misc ----

export const uuid = () => randomUUID();
export const nowIso = () => new Date().toISOString();

export const STATUSES = ["open", "in-progress", "resolved", "closed"];
export const PRIORITIES = ["low", "medium", "high", "urgent"];

export function sanitizeFileName(name) {
  const base = String(name || "file")
    .split("/")
    .pop()
    .split("\\")
    .pop();
  const clean =
    base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 100) ||
    "file";
  return clean;
}

export function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null; // signals invalid JSON
  }
}
