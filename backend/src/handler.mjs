// Lambda entry point: routes API Gateway HTTP API (payload v2.0) requests
// to the ticket/comment/attachment handlers. Auth is enforced upstream by the
// Cognito JWT authorizer; the verified JWT claims arrive at
// event.requestContext.authorizer.jwt.claims.
import {
  getClaims,
  json,
  badRequest,
  unauthorized,
  serverError,
  parseBody,
} from "./lib.mjs";
import {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
} from "./tickets.mjs";
import { addComment, listComments } from "./comments.mjs";
import { presignedUrl } from "./attachments.mjs";

function withBody(event, fn) {
  const body = parseBody(event);
  if (body === null) return badRequest("Invalid JSON body");
  return fn(body);
}

export async function handler(event) {
  try {
    const claims = getClaims(event);
    if (!claims.sub) return unauthorized();

    const method = event.requestContext?.http?.method;
    const rawPath = event.rawPath || event.requestContext?.http?.path || "/";
    const seg = rawPath.split("/").filter(Boolean);

    if (seg[0] !== "tickets") return json(404, { message: "Not found" });

    // POST /tickets/presigned-url (checked before /tickets/{ticketId} routes)
    if (method === "POST" && seg.length === 2 && seg[1] === "presigned-url") {
      return withBody(event, (body) => presignedUrl(event, claims, body));
    }

    // POST /tickets | GET /tickets
    if (seg.length === 1) {
      if (method === "POST") {
        return withBody(event, (body) => createTicket(event, claims, body));
      }
      if (method === "GET") return listTickets(event, claims);
      return json(404, { message: "Not found" });
    }

    // GET /tickets/{ticketId} | PUT /tickets/{ticketId}
    if (seg.length === 2) {
      const ticketId = decodeURIComponent(seg[1]);
      if (method === "GET") return getTicket(event, claims, ticketId);
      if (method === "PUT") {
        return withBody(event, (body) =>
          updateTicket(event, claims, ticketId, body)
        );
      }
      return json(404, { message: "Not found" });
    }

    // POST /tickets/{ticketId}/comments | GET /tickets/{ticketId}/comments
    if (seg.length === 3 && seg[2] === "comments") {
      const ticketId = decodeURIComponent(seg[1]);
      if (method === "POST") {
        return withBody(event, (body) => addComment(event, claims, ticketId, body));
      }
      if (method === "GET") return listComments(event, claims, ticketId);
      return json(404, { message: "Not found" });
    }

    return json(404, { message: "Not found" });
  } catch (err) {
    console.error("Unhandled error:", err);
    return serverError();
  }
}
