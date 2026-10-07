// Ticket CRUD + list/filter logic.
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ddb,
  env,
  json,
  badRequest,
  forbidden,
  notFound,
  getUserId,
  getEmail,
  getRole,
  isAgent,
  uuid,
  nowIso,
  STATUSES,
  PRIORITIES,
} from "./lib.mjs";
import { presignGetUrl } from "./attachments.mjs";

const UPDATABLE_FIELDS = [
  "status",
  "assignee",
  "title",
  "description",
  "priority",
  "category",
];

export function activityEntry(claims, action, detail) {
  return {
    at: nowIso(),
    by: getUserId(claims),
    byEmail: getEmail(claims),
    role: getRole(claims),
    action,
    detail: detail || "",
  };
}

export async function getTicketRecord(ticketId) {
  const res = await ddb().send(
    new GetCommand({ TableName: env().ticketsTable, Key: { ticketId } })
  );
  return res.Item || null;
}

// Returns an error response when access is denied, otherwise null.
export function assertTicketAccess(ticket, claims) {
  if (!ticket) return notFound("Ticket not found");
  if (!isAgent(claims) && ticket.customerId !== getUserId(claims)) {
    return forbidden("You can only access your own tickets");
  }
  return null;
}

export async function saveTicket(ticket) {
  await ddb().send(new PutCommand({ TableName: env().ticketsTable, Item: ticket }));
}

export async function withDownloadUrls(ticket) {
  const attachments = ticket.attachments || [];
  const enriched = await Promise.all(
    attachments.map(async (a) => ({
      ...a,
      downloadUrl: await presignGetUrl(a.key),
    }))
  );
  return { ...ticket, attachments: enriched };
}

// POST /tickets
export async function createTicket(event, claims, body) {
  const { title, description, priority, category, attachments } = body || {};
  if (!title || !description || !priority || !category) {
    return badRequest(
      "title, description, priority and category are required"
    );
  }
  if (!PRIORITIES.includes(priority)) {
    return badRequest(`priority must be one of: ${PRIORITIES.join(", ")}`);
  }
  const now = nowIso();
  const ticket = {
    ticketId: uuid(),
    title: String(title).slice(0, 200),
    description: String(description).slice(0, 5000),
    priority,
    category: String(category).slice(0, 100),
    status: "open",
    assignee: null,
    customerId: getUserId(claims),
    customerEmail: getEmail(claims),
    attachments: Array.isArray(attachments)
      ? attachments.map((a) => ({
          key: a.key,
          fileName: a.fileName,
          contentType: a.contentType,
          size: a.size || 0,
          uploadedAt: now,
        }))
      : [],
    activity: [
      activityEntry(claims, "created", `Ticket created with priority ${priority}`),
    ],
    createdAt: now,
    updatedAt: now,
  };
  await saveTicket(ticket);
  return json(201, { ticket });
}

// GET /tickets?status=&priority=
export async function listTickets(event, claims) {
  const params = event.queryStringParameters || {};
  const { status, priority } = params;
  if (status && !STATUSES.includes(status)) {
    return badRequest(`status must be one of: ${STATUSES.join(", ")}`);
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return badRequest(`priority must be one of: ${PRIORITIES.join(", ")}`);
  }
  const matches = (t) =>
    (!status || t.status === status) && (!priority || t.priority === priority);

  let tickets;
  if (isAgent(claims)) {
    // Agents see all tickets.
    const res = await ddb().send(
      new ScanCommand({ TableName: env().ticketsTable })
    );
    tickets = (res.Items || []).filter(matches);
  } else {
    // Customers see only their own tickets (efficient GSI query).
    const res = await ddb().send(
      new QueryCommand({
        TableName: env().ticketsTable,
        IndexName: "CustomerIndex",
        KeyConditionExpression: "customerId = :c",
        ExpressionAttributeValues: { ":c": getUserId(claims) },
        ScanIndexForward: false,
      })
    );
    tickets = (res.Items || []).filter(matches);
  }
  tickets.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return json(200, { tickets, count: tickets.length });
}

// GET /tickets/{ticketId}
export async function getTicket(event, claims, ticketId) {
  const ticket = await getTicketRecord(ticketId);
  const denied = assertTicketAccess(ticket, claims);
  if (denied) return denied;
  return json(200, { ticket: await withDownloadUrls(ticket) });
}

// PUT /tickets/{ticketId}
export async function updateTicket(event, claims, ticketId, body) {
  const ticket = await getTicketRecord(ticketId);
  const denied = assertTicketAccess(ticket, claims);
  if (denied) return denied;

  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return badRequest("No updatable fields provided");
  }
  if (updates.status && !STATUSES.includes(updates.status)) {
    return badRequest(`status must be one of: ${STATUSES.join(", ")}`);
  }
  if (updates.priority && !PRIORITIES.includes(updates.priority)) {
    return badRequest(`priority must be one of: ${PRIORITIES.join(", ")}`);
  }
  if (updates.title) updates.title = String(updates.title).slice(0, 200);
  if (updates.description)
    updates.description = String(updates.description).slice(0, 5000);
  if (updates.category) updates.category = String(updates.category).slice(0, 100);
  if (updates.assignee !== undefined) {
    updates.assignee =
      updates.assignee !== null && updates.assignee !== ""
        ? String(updates.assignee).slice(0, 200)
        : null;
  }

  const activity = Array.isArray(ticket.activity) ? [...ticket.activity] : [];
  let specificChange = false;
  if (updates.status !== undefined && updates.status !== ticket.status) {
    activity.push(
      activityEntry(
        claims,
        "status_changed",
        `${ticket.status} → ${updates.status}`
      )
    );
    specificChange = true;
  }
  if (updates.assignee !== undefined && updates.assignee !== ticket.assignee) {
    activity.push(
      activityEntry(
        claims,
        "assignee_changed",
        updates.assignee
          ? `Assignee set to ${updates.assignee}`
          : "Assignee cleared"
      )
    );
    specificChange = true;
  }
  if (!specificChange) {
    activity.push(activityEntry(claims, "updated", "Ticket details updated"));
  }

  const updated = { ...ticket, ...updates, activity, updatedAt: nowIso() };
  await saveTicket(updated);
  return json(200, { ticket: updated });
}
