// Thin wrapper over authFetch for the ticketing API endpoints.
import { authFetch } from "./auth.js";

export const api = {
  listTickets: (filters = {}) => {
    const q = new URLSearchParams();
    if (filters.status) q.set("status", filters.status);
    if (filters.priority) q.set("priority", filters.priority);
    const qs = q.toString();
    return authFetch(`/tickets${qs ? "?" + qs : ""}`);
  },
  createTicket: (body) =>
    authFetch("/tickets", { method: "POST", body: JSON.stringify(body) }),
  getTicket: (id) => authFetch(`/tickets/${encodeURIComponent(id)}`),
  updateTicket: (id, body) =>
    authFetch(`/tickets/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  addComment: (id, text) =>
    authFetch(`/tickets/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  listComments: (id) => authFetch(`/tickets/${encodeURIComponent(id)}/comments`),
  presignedUrl: (body) =>
    authFetch("/tickets/presigned-url", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
