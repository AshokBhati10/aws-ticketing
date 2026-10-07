// Local test harness for the ticketing Lambda.
// Runs the real handler against in-memory fakes for DynamoDB (Put/Get/Query/Scan)
// and S3 presigning — no AWS credentials needed.
//
// Usage: node test/run.mjs   (from backend/)
import { testHooks } from "../src/lib.mjs";
import { handler } from "../src/handler.mjs";

// ---------- in-memory DynamoDB fake ----------

class FakeDocClient {
  constructor() {
    this.tickets = new Map(); // ticketId -> item
    this.comments = new Map(); // `${ticketId}#${commentId}` -> item
  }
  clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  async send(cmd) {
    const name = cmd.constructor.name;
    const i = cmd.input;
    switch (name) {
      case "PutCommand": {
        if (i.TableName === "tickets") this.tickets.set(i.Item.ticketId, this.clone(i.Item));
        else this.comments.set(`${i.Item.ticketId}#${i.Item.commentId}`, this.clone(i.Item));
        return {};
      }
      case "GetCommand": {
        if (i.TableName !== "tickets") throw new Error("unsupported Get " + i.TableName);
        return { Item: this.clone(this.tickets.get(i.Key.ticketId)) };
      }
      case "QueryCommand": {
        if (i.IndexName === "CustomerIndex") {
          const sub = i.ExpressionAttributeValues[":c"];
          let items = [...this.tickets.values()].filter((t) => t.customerId === sub);
          items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          if (i.ScanIndexForward === false) {
            // already newest-first; keep as-is
          } else {
            items.reverse();
          }
          return { Items: this.clone(items) };
        }
        // comments table: ticketId = :t
        const tid = i.ExpressionAttributeValues[":t"];
        const items = [...this.comments.values()]
          .filter((c) => c.ticketId === tid)
          .sort((a, b) => a.commentId.localeCompare(b.commentId));
        return { Items: this.clone(items) };
      }
      case "ScanCommand": {
        return { Items: this.clone([...this.tickets.values()]) };
      }
      default:
        throw new Error("FakeDocClient: unsupported command " + name);
    }
  }
}

// ---------- wiring ----------

process.env.TICKETS_TABLE = "tickets";
process.env.COMMENTS_TABLE = "comments";
process.env.ATTACHMENTS_BUCKET = "attachments-bucket";
process.env.AWS_REGION = "us-east-1";

testHooks.ddb = new FakeDocClient();
testHooks.signPut = async (key) => `https://s3.example/put/${key}`;
testHooks.signGet = async (key) => `https://s3.example/get/${key}`;

// ---------- helpers ----------

const cust1 = { sub: "cust-1", email: "cust1@example.com" };
const cust2 = { sub: "cust-2", email: "cust2@example.com" };
const agent = { sub: "agent-1", email: "agent@example.com", "cognito:groups": ["Agents"] };

function evt(method, path, claims, { query = null, body = undefined } = {}) {
  return {
    version: "2.0",
    rawPath: path,
    requestContext: {
      http: { method, path },
      authorizer: { jwt: { claims } },
    },
    queryStringParameters: query,
    body: body === undefined ? null : JSON.stringify(body),
  };
}

async function call(method, path, claims, opts) {
  const res = await handler(evt(method, path, claims, opts));
  let parsed = null;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = null;
  }
  return { status: res.statusCode, body: parsed };
}

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok - ${name}`);
  } else {
    failed++;
    console.log(`  FAIL - ${name}${detail ? " :: " + detail : ""}`);
  }
}

// ---------- tests ----------

console.log("ticketing Lambda tests");

let t1, t2;

// 1. create ticket as customer -> 201
{
  const r = await call("POST", "/tickets", cust1, {
    body: { title: "Printer broken", description: "It jams every page", priority: "high", category: "Hardware" },
  });
  check("create ticket returns 201", r.status === 201, `got ${r.status}`);
  check("created ticket has ticketId + status open", !!(r.body?.ticket?.ticketId) && r.body.ticket.status === "open");
  check("owner is the customer sub", r.body?.ticket?.customerId === "cust-1");
  check("created activity entry present", (r.body?.ticket?.activity || []).some((a) => a.action === "created"));
  t1 = r.body.ticket.ticketId;
}

// 2. create second ticket as another customer; customer list shows only own
{
  const r = await call("POST", "/tickets", cust2, {
    body: { title: "VPN down", description: "cannot connect", priority: "urgent", category: "Network" },
  });
  t2 = r.body.ticket.ticketId;
  const l = await call("GET", "/tickets", cust1);
  check("customer list returns 200", l.status === 200, `got ${l.status}`);
  check("customer sees only own tickets", l.body.count === 1 && l.body.tickets[0].ticketId === t1, JSON.stringify(l.body));
}

// 3. agent sees all tickets
{
  const l = await call("GET", "/tickets", agent);
  check("agent sees all tickets", l.status === 200 && l.body.count === 2, JSON.stringify(l.body));
}

// 4. filters: status + priority
{
  const byStatus = await call("GET", "/tickets", agent, { query: { status: "open" } });
  check("status=open filter returns both", byStatus.body.count === 2);
  const byPrio = await call("GET", "/tickets", agent, { query: { priority: "urgent" } });
  check("priority=urgent filter returns 1", byPrio.body.count === 1 && byPrio.body.tickets[0].ticketId === t2);
  const bad = await call("GET", "/tickets", agent, { query: { status: "bogus" } });
  check("invalid status filter -> 400", bad.status === 400, `got ${bad.status}`);
}

// 5. get detail includes activity + attachments shape
{
  const r = await call("GET", `/tickets/${t1}`, cust1);
  check("get own ticket -> 200", r.status === 200, `got ${r.status}`);
  check("detail has activity array", Array.isArray(r.body?.ticket?.activity) && r.body.ticket.activity.length >= 1);
}

// 6. update status + assignee as agent; activity entries logged
{
  const r = await call("PUT", `/tickets/${t1}`, agent, {
    body: { status: "in-progress", assignee: "agent-1" },
  });
  check("update returns 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);
  check("status updated", r.body?.ticket?.status === "in-progress");
  check("assignee updated", r.body?.ticket?.assignee === "agent-1");
  const acts = (r.body?.ticket?.activity || []).map((a) => a.action);
  check("status_changed activity logged", acts.includes("status_changed"));
  check("assignee_changed activity logged", acts.includes("assignee_changed"));
  // generic update entry when only other fields change
  const r2 = await call("PUT", `/tickets/${t1}`, agent, { body: { title: "Printer really broken" } });
  check("generic updated activity logged", (r2.body?.ticket?.activity || []).some((a) => a.action === "updated"));
}

// 7. add comment + list comments
{
  const r = await call("POST", `/tickets/${t1}/comments`, cust1, { body: { text: "Any update?" } });
  check("add comment -> 201", r.status === 201, `got ${r.status}`);
  check("comment has author fields", r.body?.comment?.authorId === "cust-1" && r.body?.comment?.text === "Any update?");
  const l = await call("GET", `/tickets/${t1}/comments`, cust1);
  check("list comments -> 1 comment", l.status === 200 && l.body.count === 1, JSON.stringify(l.body));
  // comment appends activity
  const d = await call("GET", `/tickets/${t1}`, cust1);
  check("comment_added activity logged", (d.body?.ticket?.activity || []).some((a) => a.action === "comment_added"));
  const empty = await call("POST", `/tickets/${t1}/comments`, cust1, { body: { text: "   " } });
  check("empty comment -> 400", empty.status === 400, `got ${empty.status}`);
}

// 8. presigned-url shape
{
  const r = await call("POST", "/tickets/presigned-url", cust1, {
    body: { ticketId: t1, fileName: "screenshot.png", contentType: "image/png", size: 1234 },
  });
  check("presigned-url -> 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);
  check("response has uploadUrl/key/fileName/expiresIn", !!(r.body?.uploadUrl && r.body?.key && r.body?.fileName && r.body?.expiresIn === 900));
  check("key uses attachments/ prefix", String(r.body?.key || "").startsWith("attachments/"));
  const missing = await call("POST", "/tickets/presigned-url", cust1, { body: { contentType: "image/png" } });
  check("missing fileName -> 400", missing.status === 400, `got ${missing.status}`);
  const big = await call("POST", "/tickets/presigned-url", cust1, {
    body: { fileName: "big.bin", contentType: "application/octet-stream", size: 11 * 1024 * 1024 },
  });
  check(">10MB rejected -> 400", big.status === 400, `got ${big.status}`);
}

// 9. 403: customer accessing another customer's ticket
{
  const r = await call("GET", `/tickets/${t2}`, cust1);
  check("customer reading other's ticket -> 403", r.status === 403, `got ${r.status}`);
  const u = await call("PUT", `/tickets/${t2}`, cust1, { body: { status: "closed" } });
  check("customer updating other's ticket -> 403", u.status === 403, `got ${u.status}`);
}

// 10. 404 unknown ticket
{
  const r = await call("GET", "/tickets/does-not-exist", agent);
  check("unknown ticket -> 404", r.status === 404, `got ${r.status}`);
}

// 11. 400 missing fields on create
{
  const r = await call("POST", "/tickets", cust1, { body: { title: "x" } });
  check("create with missing fields -> 400", r.status === 400, `got ${r.status}`);
  const p = await call("POST", "/tickets", cust1, {
    body: { title: "x", description: "y", priority: "extreme", category: "z" },
  });
  check("create with bad priority -> 400", p.status === 400, `got ${p.status}`);
}

// 12. unauthorized without claims
{
  const res = await handler({ requestContext: { http: { method: "GET" }, authorizer: { jwt: { claims: {} } } }, rawPath: "/tickets" });
  check("no sub -> 401", res.statusCode === 401, `got ${res.statusCode}`);
}

// 13. attachments + presigned GET downloadUrl on ticket detail
{
  const key = "attachments/" + t1 + "/abc-shot.png";
  const r = await call("POST", "/tickets", cust1, {
    body: {
      title: "With attachment", description: "see file", priority: "low", category: "Other",
      attachments: [{ key, fileName: "shot.png", contentType: "image/png", size: 42 }],
      },
  });
  check("create with attachments -> 201", r.status === 201, `got ${r.status}`);
  const tid = r.body.ticket.ticketId;
  const d = await call("GET", `/tickets/${tid}`, cust1);
  check("detail exposes presigned downloadUrl", String(d.body?.ticket?.attachments?.[0]?.downloadUrl || "").startsWith("https://s3.example/get/"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
