// Comment add/list logic.
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  ddb,
  env,
  json,
  badRequest,
  getUserId,
  getEmail,
  getRole,
  uuid,
  nowIso,
} from "./lib.mjs";
import {
  getTicketRecord,
  assertTicketAccess,
  saveTicket,
  activityEntry,
} from "./tickets.mjs";

// POST /tickets/{ticketId}/comments
export async function addComment(event, claims, ticketId, body) {
  const ticket = await getTicketRecord(ticketId);
  const denied = assertTicketAccess(ticket, claims);
  if (denied) return denied;
  const text = body && typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return badRequest("text is required");
  if (text.length > 2000) return badRequest("text must not exceed 2000 characters");

  const now = nowIso();
  const comment = {
    commentId: `${now}_${uuid().slice(0, 8)}`, // sorts chronologically ascending
    ticketId,
    authorId: getUserId(claims),
    authorEmail: getEmail(claims),
    authorRole: getRole(claims),
    text: text.slice(0, 2000),
    createdAt: now,
  };
  await ddb().send(
    new PutCommand({ TableName: env().commentsTable, Item: comment })
  );

  const activity = Array.isArray(ticket.activity) ? [...ticket.activity] : [];
  activity.push(activityEntry(claims, "comment_added", "A comment was added"));
  await saveTicket({ ...ticket, activity, updatedAt: now });

  return json(201, { comment });
}

// GET /tickets/{ticketId}/comments
export async function listComments(event, claims, ticketId) {
  const ticket = await getTicketRecord(ticketId);
  const denied = assertTicketAccess(ticket, claims);
  if (denied) return denied;
  const res = await ddb().send(
    new QueryCommand({
      TableName: env().commentsTable,
      KeyConditionExpression: "ticketId = :t",
      ExpressionAttributeValues: { ":t": ticketId },
    })
  );
  const comments = (res.Items || []).sort((a, b) =>
    a.commentId.localeCompare(b.commentId)
  );
  return json(200, { comments, count: comments.length });
}
