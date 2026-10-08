#!/usr/bin/env node
// seed-dummy-tickets.js
//
// Creates 200 realistic demo tickets in the existing DynamoDB tickets table.
// This script ONLY writes ticket records - it never creates or modifies any
// AWS infrastructure, Cognito users/groups, or application code.
//
// Idempotent: ticket IDs are deterministic (demo-seed-0001 ... demo-seed-0200)
// and existing items are never overwritten, so re-running is safe.
//
// Usage:
//   cd scripts && npm install        # once, installs the AWS SDK
//   node scripts/seed-dummy-tickets.js --customer-sub "<COGNITO_SUB>" [--customer-email "user@example.com"] [--table <table>] [--region ap-southeast-2] [--dry-run]
//   node scripts/seed-dummy-tickets.js --cleanup [--table <table>] [--region ap-southeast-2]
//
// Table name: pass --table or set TICKETS_TABLE. Find it with:
//   aws cloudformation describe-stacks --stack-name <stack> --region ap-southeast-2 --query "Stacks[0].Outputs"
//   (look for the TicketsTableName output)
// Credentials come from the standard AWS SDK chain (e.g. your AWS CLI
// profile). This script never accepts, stores, or prints credentials.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { pathToFileURL } from "url";

export const SEED_BATCH = "demo-seed-v1";
export const TICKET_COUNT = 200;
export const DEFAULT_REGION = "ap-southeast-2";
export const DEFAULT_CUSTOMER_EMAIL = "demo.customer@example.com";
const PRNG_SEED = 20261008;

export const STATUSES = ["open", "in-progress", "resolved", "closed"];
export const PRIORITIES = ["low", "medium", "high", "urgent"];
export const CATEGORIES = [
  "Hardware",
  "Software",
  "Network",
  "Access",
  "Billing",
  "Other",
];

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32). A fixed seed means every run generates the
// identical 200 tickets (timestamps are anchored to the run time).
// ---------------------------------------------------------------------------
export function createRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(rng, pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rng() * total;
  for (const [value, weight] of pairs) {
    r -= weight;
    if (r < 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fill(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) =>
    ctx[k] !== undefined ? String(ctx[k]) : `{${k}}`
  );
}

// ---------------------------------------------------------------------------
// Realistic filler pools (combinatorial templates below draw from these).
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  "Aarav", "Ananya", "Arjun", "Diya", "Ishaan", "Kavya", "Krishna",
  "Meera", "Nikhil", "Priya", "Rahul", "Riya", "Rohan", "Sanya",
  "Vikram", "Zara", "Aditya", "Farah", "Gopal", "Lakshmi",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Patel", "Reddy", "Nair", "Gupta",
  "Mehta", "Khan", "Das", "Kulkarni", "Joshi", "Agarwal", "Menon",
];
const AGENT_NAMES = [
  "Priya Sharma",
  "Rahul Verma",
  "Anita Desai",
  "Vikram Rao",
  "Neha Iyer",
  "Arjun Mehta",
];
const BROWSERS = ["Chrome 126", "Chrome 127", "Edge 125", "Firefox 128", "Safari 17.5"];
const OSES = ["Windows 11", "macOS Sonoma", "macOS Sequoia", "Ubuntu 24.04"];
const ERROR_CODES = [
  "ERR-5021", "ERR-4408", "ERR-7712", "AUTH-310", "UPL-209",
  "API-5500", "SYNC-114", "RPT-902", "MAIL-441", "NET-207",
];
const PRODUCTS = [
  "the ticketing portal",
  "the customer dashboard",
  "the reporting module",
  "the mobile app",
  "the API integration",
];
const MONTHS = ["Aug", "Sep", "Oct"];

// ---------------------------------------------------------------------------
// 20 support topics x 6 UI categories. Titles and descriptions are combined
// with the filler pools above so all 200 tickets are unique and realistic.
// ---------------------------------------------------------------------------
const TOPICS = [
  {
    category: "Access",
    titles: [
      "Cannot log in - says invalid credentials but password is correct",
      "Login page reloads without error after I click Sign in",
      "Locked out of my account after too many attempts",
      "SSO login fails with error {code}",
      "Can log in on my phone but not on {browser}",
    ],
    descriptions: [
      "Hi team, I have been unable to log in since {date}. I am certain the password is correct because I changed it last week, but the page keeps saying invalid credentials. I tried on {browser} on {os} and cleared my cache. I need access urgently to follow up on order {order}.",
      "Whenever I enter my email and password and click Sign in, the page just reloads back to the login screen with no error message at all. I tried an incognito window and a different browser. This started happening after the {version} update on {date}.",
      "My account got locked after I mistyped my password a few times this morning. The message says to contact support. My registered email is {email}. Please unlock it - I have a client demo at 2pm.",
    ],
  },
  {
    category: "Access",
    titles: [
      "Password reset email never arrives",
      "Reset password link says it has expired immediately",
      "Password reset page shows error {code}",
      "Did not receive the verification code by email",
    ],
    descriptions: [
      "I requested a password reset three times today and never received the email, not even in spam. My email is {email} and I checked the spelling twice. Can you please resend it or reset it manually?",
      "The reset link in the email takes me to a page that says the link has expired, even though I clicked it within two minutes of receiving it. I tried on {browser} and on my phone with the same result.",
      "I am trying to set a new password but the form rejects everything I type with error {code}. I tried 16 characters with symbols and numbers, so it should meet the policy. What are the exact password rules?",
    ],
  },
  {
    category: "Access",
    titles: [
      "Account locked - need it unlocked before EOD",
      "My account shows as disabled when I try to sign in",
      "Account suspended for no apparent reason",
    ],
    descriptions: [
      "My account appears to be locked since this morning around 9am. I get a message saying the account is disabled. I did not share my credentials with anyone. This is blocking my work on order {order}, so I would appreciate a quick unlock.",
      "I tried signing in today and got a notice that my account has been suspended. I have no idea why - I have not done anything unusual, just my normal daily work in {product}. Please investigate and restore access.",
    ],
  },
  {
    category: "Access",
    titles: [
      "Access denied on the shared Finance folder",
      "Cannot open tickets assigned to my team",
      "Permission error when trying to view the {product}",
      "New team member {name} cannot see our workspace",
    ],
    descriptions: [
      "I get an 'access denied' message when I try to open the shared Finance folder, even though my manager approved my access last week. My colleague {name} can open it fine. Can you check my permissions?",
      "Our new hire {name} joined on {date} and still cannot see the team workspace. Their account is active and they can log in, but every page shows a permission error. Their email is {email}.",
      "Since yesterday I cannot open tickets assigned to my team - I get a 403 error. I could open them fine last week and nothing about my role has changed as far as I know. Example ticket from {order}.",
    ],
  },
  {
    category: "Access",
    titles: [
      "Profile email change does not save",
      "Cannot update my phone number in profile settings",
      "Profile picture upload keeps failing",
    ],
    descriptions: [
      "I tried to update my email address in profile settings from {email} to my new work email. The form says saved, but when I reload the page the old email is back. I tried on {browser} on {os}.",
      "My phone number in the profile is outdated and I cannot change it - the save button spins forever and then nothing happens. I need the correct number on file for the two-factor codes.",
    ],
  },
  {
    category: "Billing",
    titles: [
      "Card declined at checkout even though funds are available",
      "Payment failed with error {code} for order {order}",
      "Charged twice for the same subscription",
      "Payment page times out before completing",
    ],
    descriptions: [
      "I tried to pay invoice {invoice} for {amount} this morning and the card was declined. I called my bank and they confirmed there is no block and sufficient funds. The error on screen was {code}. Can you check whether the payment actually went through on your side?",
      "My card was charged twice for the September subscription - two identical charges of {amount} on {date}. I only clicked pay once. Please refund the duplicate charge to the card ending 4412.",
      "The payment page spins for about a minute and then times out. I tried three times on {browser}. I am worried I will be charged three times, so I stopped. Order reference {order}.",
    ],
  },
  {
    category: "Billing",
    titles: [
      "Invoice {invoice} shows the wrong amount",
      "Was charged {amount} but my plan costs less",
      "Discount code not applied to invoice {invoice}",
      "Need a GST invoice for order {order}",
    ],
    descriptions: [
      "Invoice {invoice} shows {amount} but my plan is supposed to be billed at the annual discounted rate we agreed in August. The extra charge looks like the monthly rate was applied instead. Please correct the invoice.",
      "I applied the WELCOME20 discount code at checkout but invoice {invoice} shows the full amount of {amount} with no discount line. The code was accepted on the payment page. Can you reissue the invoice with the discount?",
      "Hi, I need a proper GST invoice for order {order} for our accounts department. The receipt I downloaded does not show the GSTIN. Our GSTIN is 29ABCDE1234F1Z5. Please email the corrected invoice to {email}.",
    ],
  },
  {
    category: "Billing",
    titles: [
      "Cannot download invoice PDF for {invoice}",
      "Invoice download button does nothing",
      "Invoice PDF is blank when opened",
    ],
    descriptions: [
      "When I click Download on invoice {invoice}, nothing happens - no file, no error. I tried on {browser} and {os}, and disabled my popup blocker. I need this invoice for reimbursement by Friday.",
      "The invoice PDF downloads but opens completely blank in Acrobat. The file size is only {size}. Other PDFs open fine, so it seems specific to this invoice. Invoice number {invoice}, order {order}.",
    ],
  },
  {
    category: "Software",
    titles: [
      "File upload fails at 99 percent every time",
      "Upload times out for files larger than {size}",
      "Cannot upload {file} - unsupported format error",
      "Upload progress bar freezes halfway",
    ],
    descriptions: [
      "I am trying to upload a {size} PDF report and the progress bar reaches 99 percent and then fails with error {code}. Smaller files under 5MB upload fine. This started after the {version} release. I am on {browser}, {os}.",
      "The system rejects my {file} file saying unsupported format, but it is a standard PDF exported from Word. I renamed it and tried again with the same error. The file opens fine locally.",
    ],
  },
  {
    category: "Software",
    titles: [
      "Attachment shows 0 bytes after upload",
      "Cannot open attachments on older tickets",
      "Attachment preview shows a broken image icon",
      "Uploading multiple attachments only keeps the first one",
    ],
    descriptions: [
      "I attached two screenshots to my ticket yesterday and both now show as 0 bytes and cannot be downloaded. The upload appeared to complete normally at the time. Ticket from order {order}.",
      "When I try to open attachments on tickets older than a month, I get an error saying the file is unavailable. Recent attachments open fine. Example: the invoice PDF on my August ticket.",
      "I selected four files to attach but only the first one was saved. I tried twice. Each file is under 2MB, so size should not be the issue. Using {browser} on {os}.",
    ],
  },
  {
    category: "Software",
    titles: [
      "Dashboard takes over a minute to load",
      "Dashboard widgets show spinning loaders forever",
      "Dashboard shows data from last week, not today",
      "Blank white screen after logging into the dashboard",
    ],
    descriptions: [
      "The main dashboard has become very slow since {date} - it takes more than a minute to load and the widgets populate one by one. My internet is fine (100 Mbps) and other sites are fast. I am on {browser}, {os}.",
      "After logging in I just get a blank white screen. No error, nothing in the console that I can understand. I tried clearing the cache and it worked once, then the blank screen came back.",
      "The dashboard numbers do not match what I see in the ticket list - it looks like the dashboard is showing data from last week. I refreshed multiple times. The ticket counts are off by about 40.",
    ],
  },
  {
    category: "Software",
    titles: [
      "Search returns no results for tickets I know exist",
      "Search results are outdated - missing this week's tickets",
      "Search by ticket ID gives a 404 page",
      "Filtering by status shows the wrong tickets",
    ],
    descriptions: [
      "When I search for 'invoice' I get zero results, but I know I have at least five tickets with invoice in the title from last month. The search worked fine two weeks ago. Nothing about my account changed.",
      "Searching by ticket ID takes me to a 404 page even for tickets I opened myself yesterday. If I go through the ticket list and click the same ticket, it opens fine. So the ticket exists - only the search link is broken.",
      "I filtered the list by status 'resolved' but the results include open tickets too. The count at the top says 12 but the table shows 30 rows. This makes the filter useless for my weekly review.",
    ],
  },
  {
    category: "Software",
    titles: [
      "API returns 500 when creating a ticket with an attachment",
      "API error {code} on {api} endpoint since {date}",
      "API rate limit hit with only a few requests",
      "Webhook deliveries failing with timeout",
    ],
    descriptions: [
      "Our integration started failing on {date}: POST to {api} returns 500 whenever the payload includes an attachment. Without attachments it works. Nothing changed on our side; we are on {version} of your SDK. Here is a sample request ID from this morning.",
      "We are getting 429 rate-limit responses after only about 20 requests per minute, but our plan allows 300. This started suddenly yesterday and is breaking our sync job. API key ending ...9f31.",
      "Webhooks to our endpoint have been timing out for the last two days. Our server logs show your requests arriving but your dashboard shows them as failed. The endpoint responds in under 200ms when we test manually.",
    ],
  },
  {
    category: "Software",
    titles: [
      "Mobile app layout broken on small screens",
      "Buttons overlap on the ticket detail page on mobile",
      "Cannot attach photos from the mobile app",
      "App crashes when opening notifications",
    ],
    descriptions: [
      "On my phone the ticket detail page is unreadable - the action buttons overlap the description text and I cannot tap Resolve. This is on the mobile web version in {browser}, screen width 360px. It was fine last month.",
      "The mobile app crashes every time I tap a push notification. I reinstalled the app and it still happens. Phone is on the latest OS, app version {version}. I can open tickets normally from inside the app.",
      "Attaching a photo from the mobile app fails with 'upload failed' instantly, before any progress. Photos from the gallery and the camera both fail. Works fine from the desktop site.",
    ],
  },
  {
    category: "Software",
    titles: [
      "Monthly report export has missing rows",
      "CSV export contains garbled characters",
      "Report numbers do not match the dashboard",
      "Scheduled report email never arrived",
    ],
    descriptions: [
      "The September ticket report I exported is missing about 30 rows compared to what I see in the UI with the same filters. I exported twice and both files are missing the same tickets, all from the last week of the month.",
      "The CSV export opens with garbled characters for customer names - looks like an encoding issue. Names with special characters are replaced with question marks. The on-screen report displays them correctly.",
      "I was supposed to receive the scheduled weekly report yesterday morning but it never arrived, not even in spam. The schedule still shows as active in settings. This is the second week in a row.",
    ],
  },
  {
    category: "Software",
    titles: [
      "Not receiving email notifications for new tickets",
      "Push notifications arrive hours late",
      "Notification preferences reset themselves",
      "Getting notifications for other people's tickets",
    ],
    descriptions: [
      "I stopped receiving email notifications for new tickets assigned to me around {date}. I checked spam and my notification settings, which are all enabled. My colleague {name} still gets theirs, so it seems specific to my account ({email}).",
      "My notification preferences keep resetting to defaults overnight. I turn off the daily digest every morning and by the next day it is back on. Very annoying - please fix the save.",
      "I am getting email notifications for tickets assigned to {name}, who is on a different team. I should not be seeing these at all. This started after the team restructuring last month.",
    ],
  },
  {
    category: "Network",
    titles: [
      "Order confirmation emails delayed by hours",
      "Emails to {email} bounce with error {code}",
      "Not receiving any emails from the platform since {date}",
    ],
    descriptions: [
      "Order confirmation emails are arriving 4-6 hours late since {date}. Customers are calling us asking where their confirmations are. Our mail server logs show your messages arriving late, error {code} on some of them.",
      "Emails sent to addresses at our company domain bounce back with {code}. Personal Gmail addresses receive them fine, so it looks like your sending IPs may be on a blocklist for corporate filters.",
    ],
  },
  {
    category: "Network",
    titles: [
      "VPN disconnects every 10 minutes since {date}",
      "Cannot reach the office network from home",
      "VPN connects but no internal sites load",
    ],
    descriptions: [
      "My VPN connection drops roughly every 10 minutes and I have to reconnect manually. This started on {date} and happens on both my laptop and phone hotspot, so it is not my home internet. I am on {os}.",
      "The VPN connects successfully but I cannot load any internal sites - they all time out. Internet works fine otherwise. My colleague sitting next to me has no issues, so it seems specific to my connection.",
    ],
  },
  {
    category: "Hardware",
    titles: [
      "Office printer {printer} not responding",
      "Printer prints blank pages since {date}",
      "Laptop fan very loud and machine overheating",
      "Request: replacement keyboard for workstation 12",
    ],
    descriptions: [
      "The office printer {printer} is not responding to print jobs since this morning. It shows as online but jobs just sit in the queue. I restarted it twice. Several of us are affected, so it is not just my laptop.",
      "My laptop has become extremely slow over the past two weeks - it takes 10 minutes to boot and the fan runs constantly. I have closed everything unnecessary. It is a 2021 model, asset tag LT-8841. Probably needs a service.",
      "The spacebar on the keyboard at workstation 12 only works if pressed very hard. Can I get a replacement keyboard? It is a standard USB Dell keyboard.",
    ],
  },
  {
    category: "Other",
    titles: [
      "How do I export my data before cancelling?",
      "Question about the difference between plans",
      "Can I transfer ticket ownership to {name}?",
      "Request for a demo of the reporting features",
    ],
    descriptions: [
      "We are evaluating whether to continue next quarter and I need to know how to export all our tickets and attachments in a usable format before making a decision. Is there a bulk export option, or do I need to use the API?",
      "What is the practical difference between the Team and Business plans for a 15-person support team? The pricing page lists features but I want to know which plan gives us SLA reporting and custom roles.",
      "I am moving to a different team next month and need to transfer ownership of my open tickets to {name}. Is there a bulk transfer option, or do I need to reassign them one by one?",
    ],
  },
];

// ---------------------------------------------------------------------------
// Ticket generation. Deterministic: same seed => identical tickets every run.
// ---------------------------------------------------------------------------
export function seededTicketIds() {
  const ids = [];
  for (let i = 1; i <= TICKET_COUNT; i++) {
    ids.push(`demo-seed-${String(i).padStart(4, "0")}`);
  }
  return ids;
}

function makeContext(rng) {
  const day = 1 + Math.floor(rng() * 28);
  return {
    name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
    order: `#ORD-${10000 + Math.floor(rng() * 89999)}`,
    invoice: `INV-2026-${1000 + Math.floor(rng() * 8999)}`,
    code: pick(rng, ERROR_CODES),
    version: `v${1 + Math.floor(rng() * 4)}.${Math.floor(rng() * 20)}.${Math.floor(rng() * 9)}`,
    amount: `$${(10 + rng() * 490).toFixed(2)}`,
    date: `${pick(rng, MONTHS)} ${day}`,
    browser: pick(rng, BROWSERS),
    os: pick(rng, OSES),
    product: pick(rng, PRODUCTS),
    email: `user${100 + Math.floor(rng() * 899)}@example.com`,
    file: `report-Q${1 + Math.floor(rng() * 4)}.${pick(rng, ["pdf", "xlsx", "csv", "png"])}`,
    size: `${2 + Math.floor(rng() * 48)}MB`,
    printer: `HP LaserJet ${pick(rng, ["M404", "M428", "M479"])}`,
    api: pick(rng, ["/tickets", "/tickets/{id}/comments", "/attachments/presign", "/tickets/search"]),
  };
}

export function generateTickets({ customerSub, customerEmail, now }) {
  if (!customerSub) throw new Error("customerSub is required");
  const email = customerEmail || DEFAULT_CUSTOMER_EMAIL;
  const rng = createRng(PRNG_SEED);
  // `now` is injectable so tests can assert full determinism; the CLI omits
  // it and tickets are anchored to the current time instead.
  const anchor = now !== undefined ? now : Date.now();
  const ids = seededTicketIds();
  const usedTitles = new Set();
  const tickets = [];

  for (let i = 0; i < TICKET_COUNT; i++) {
    const topic = pick(rng, TOPICS);
    const ctx = makeContext(rng);

    // Unique title (combinatorial templates + filler values; guarded anyway).
    let title = fill(pick(rng, topic.titles), ctx);
    let guard = 0;
    while (usedTitles.has(title) && guard < 100) {
      guard++;
      title = `${fill(pick(rng, topic.titles), ctx)} (ref ${ctx.order}-${guard})`;
    }
    if (usedTitles.has(title)) {
      throw new Error(`Could not generate a unique title for ticket ${ids[i]}`);
    }
    usedTitles.add(title);

    const status = pickWeighted(rng, [
      ["open", 40],
      ["in-progress", 30],
      ["resolved", 25],
      ["closed", 5],
    ]);
    const priority = pickWeighted(rng, [
      ["low", 20],
      ["medium", 40],
      ["high", 30],
      ["urgent", 10],
    ]);
    const assignee = rng() < 0.5 ? null : pick(rng, AGENT_NAMES);

    // createdAt spread over the last ~60 days; updatedAt >= createdAt.
    const createdMs = anchor - Math.floor(rng() * 60 * 24 * 3600 * 1000);
    const createdAt = new Date(createdMs).toISOString();
    let updatedMs = createdMs;

    const activity = [
      {
        at: createdAt,
        by: customerSub,
        byEmail: email,
        role: "customer",
        action: "created",
        detail: `Ticket created with priority ${priority}`,
      },
    ];
    if (status !== "open") {
      const t1 = createdMs + Math.floor((1 + rng() * 47) * 3600 * 1000);
      activity.push({
        at: new Date(t1).toISOString(),
        by: "demo-agent",
        byEmail: "demo.agent@example.com",
        role: "agent",
        action: "status_changed",
        detail: "open -> in-progress",
      });
      updatedMs = t1;
      if (status === "resolved" || status === "closed") {
        const t2 = t1 + Math.floor((1 + rng() * 71) * 3600 * 1000);
        activity.push({
          at: new Date(t2).toISOString(),
          by: "demo-agent",
          byEmail: "demo.agent@example.com",
          role: "agent",
          action: "status_changed",
          detail: "in-progress -> resolved",
        });
        updatedMs = t2;
      }
    }
    const updatedAt = new Date(updatedMs).toISOString();

    tickets.push({
      ticketId: ids[i],
      title: String(title).slice(0, 200),
      description: fill(pick(rng, topic.descriptions), ctx).slice(0, 5000),
      priority,
      category: topic.category,
      status,
      assignee,
      customerId: customerSub,
      customerEmail: email,
      attachments: [],
      activity,
      createdAt,
      updatedAt,
      seedBatch: SEED_BATCH,
    });
  }

  // Sanity assertions: deterministic IDs and unique titles.
  const idSet = new Set(tickets.map((t) => t.ticketId));
  if (idSet.size !== TICKET_COUNT) throw new Error("Duplicate ticket IDs generated");
  if (usedTitles.size !== TICKET_COUNT) throw new Error("Duplicate titles generated");
  for (const t of tickets) {
    if (!STATUSES.includes(t.status)) throw new Error(`Invalid status: ${t.status}`);
    if (!PRIORITIES.includes(t.priority)) throw new Error(`Invalid priority: ${t.priority}`);
    if (!CATEGORIES.includes(t.category)) throw new Error(`Invalid category: ${t.category}`);
    if (t.updatedAt < t.createdAt) throw new Error("updatedAt before createdAt");
  }
  return tickets;
}

// ---------------------------------------------------------------------------
// DynamoDB helpers (document client is injectable for testing).
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backoff(attempt) {
  await sleep(Math.min(200 * 2 ** attempt, 5000) + Math.floor(Math.random() * 100));
}

async function batchGetByIds(client, tableName, ids) {
  const found = new Map();
  for (const chunk of chunkArray(ids, 100)) {
    let pending = chunk.map((ticketId) => ({ ticketId }));
    let attempt = 0;
    while (pending.length > 0) {
      if (attempt >= 5) {
        throw new Error("BatchGetItem: keys still unprocessed after 5 attempts");
      }
      const res = await client.send(
        new BatchGetCommand({
          RequestItems: { [tableName]: { Keys: pending } },
        })
      );
      for (const item of (res.Responses && res.Responses[tableName]) || []) {
        found.set(item.ticketId, item);
      }
      const unp =
        res.UnprocessedKeys &&
        res.UnprocessedKeys[tableName] &&
        res.UnprocessedKeys[tableName].Keys;
      pending = unp || [];
      if (pending.length > 0) {
        attempt++;
        await backoff(attempt);
      }
    }
  }
  return found;
}

async function batchWriteRequests(client, tableName, requests) {
  for (const chunk of chunkArray(requests, 25)) {
    let pending = chunk;
    let attempt = 0;
    while (pending.length > 0) {
      if (attempt >= 5) {
        throw new Error(
          `BatchWriteItem: ${pending.length} request(s) still unprocessed after 5 attempts`
        );
      }
      const res = await client.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: pending } })
      );
      pending = (res.UnprocessedItems && res.UnprocessedItems[tableName]) || [];
      if (pending.length > 0) {
        attempt++;
        await backoff(attempt);
      }
    }
  }
}

// Idempotent: only puts tickets whose deterministic ID does not exist yet.
// Never overwrites existing items (seeded or real).
export async function seedTickets({ client, tableName, tickets }) {
  const existing = await batchGetByIds(
    client,
    tableName,
    tickets.map((t) => t.ticketId)
  );
  const missing = tickets.filter((t) => !existing.has(t.ticketId));
  await batchWriteRequests(
    client,
    tableName,
    missing.map((t) => ({ PutRequest: { Item: t } }))
  );
  return {
    created: missing.length,
    alreadyExist: tickets.length - missing.length,
    total: tickets.length,
  };
}

// Deletes ONLY tickets created by this script (marker-gated). Never touches
// real user tickets, even if an ID somehow collided.
export async function cleanupSeededTickets({ client, tableName }) {
  const found = await batchGetByIds(client, tableName, seededTicketIds());
  const seeded = [...found.values()].filter((t) => t.seedBatch === SEED_BATCH);
  await batchWriteRequests(
    client,
    tableName,
    seeded.map((t) => ({ DeleteRequest: { Key: { ticketId: t.ticketId } } }))
  );
  return { removed: seeded.length };
}

function buildClient(region) {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/seed-dummy-tickets.js --customer-sub \"<COGNITO_SUB>\" [--customer-email \"user@example.com\"] [--table <table>] [--region ap-southeast-2] [--dry-run]",
    "  node scripts/seed-dummy-tickets.js --cleanup [--table <table>] [--region ap-southeast-2] [--dry-run]",
    "",
    "Find the table name with:",
    '  aws cloudformation describe-stacks --stack-name <stack> --region ap-southeast-2 --query "Stacks[0].Outputs"',
    "  (use the TicketsTableName output, or set the TICKETS_TABLE env var)",
  ].join("\n");
}

function requireTableName(args) {
  const tableName = args.table || process.env.TICKETS_TABLE;
  if (!tableName) {
    console.error(
      "Error: no table name given. Pass --table <name> or set TICKETS_TABLE.\n" +
        "Find it with:\n" +
        '  aws cloudformation describe-stacks --stack-name <stack> --region ap-southeast-2 --query "Stacks[0].Outputs"\n' +
        "  (use the TicketsTableName output)"
    );
    process.exit(2);
  }
  return tableName;
}

function printDistribution(tickets) {
  const count = (fn) => {
    const m = {};
    for (const t of tickets) m[fn(t)] = (m[fn(t)] || 0) + 1;
    return m;
  };
  console.log("status:  ", JSON.stringify(count((t) => t.status)));
  console.log("priority:", JSON.stringify(count((t) => t.priority)));
  console.log("category:", JSON.stringify(count((t) => t.category)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const region = args.region || DEFAULT_REGION;

  if (args.cleanup) {
    const tableName = requireTableName(args);
    if (args["dry-run"]) {
      console.log(
        `dry-run: would delete up to ${TICKET_COUNT} tickets with seedBatch "${SEED_BATCH}" from ${tableName} (${region}). No AWS calls made.`
      );
      return;
    }
    const client = buildClient(region);
    const { removed } = await cleanupSeededTickets({ client, tableName });
    console.log(`${removed} dummy tickets removed`);
    return;
  }

  const customerSub = args["customer-sub"];
  if (!customerSub) {
    console.error(
      "Error: --customer-sub is required (the real Cognito sub of the demo customer).\n\n" +
        usage()
    );
    process.exit(2);
  }
  const tableName = requireTableName(args);
  const tickets = generateTickets({
    customerSub,
    customerEmail: args["customer-email"] || DEFAULT_CUSTOMER_EMAIL,
  });

  if (args["dry-run"]) {
    console.log(`dry-run: generated ${tickets.length} tickets (no AWS calls made)`);
    printDistribution(tickets);
    console.log("sample:");
    for (const t of tickets.slice(0, 3)) {
      console.log(`  ${t.ticketId} [${t.status}/${t.priority}/${t.category}] ${t.title}`);
    }
    return;
  }

  const client = buildClient(region);
  const { created, alreadyExist, total } = await seedTickets({
    client,
    tableName,
    tickets,
  });
  if (alreadyExist === 0) {
    console.log(`${created} created`);
  } else {
    console.log(`${created} created, ${alreadyExist} already exist (of ${total})`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
