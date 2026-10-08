# AWS Serverless Ticketing System — POC

A minimal, fully functional ticketing system built in one day on AWS serverless
services: a Vue 3 frontend, Cognito Hosted UI authentication, an API Gateway
HTTP API protected by a Cognito JWT authorizer, a single Node.js 20 Lambda,
DynamoDB for ticket/comment data, and S3 for file attachments (via presigned
URLs so files never pass through Lambda).

Customers create and view their own tickets; agents (members of the Cognito
`Agents` group) see all tickets and can update status/assignee. Both roles can
add comments and attach files.

## Technology stack

| Layer    | Technology                                          |
|----------|-----------------------------------------------------|
| Frontend | Vue.js 3 + Vite + Tailwind CSS v4                   |
| Auth     | Amazon Cognito User Pool + Hosted UI (OAuth2 code + PKCE, no Amplify) |
| API      | Amazon API Gateway HTTP API + Cognito JWT authorizer |
| Backend  | AWS Lambda, Node.js 20, AWS SDK for JavaScript v3   |
| Database | Amazon DynamoDB (on-demand)                         |
| Storage  | Amazon S3 (presigned PUT for uploads, presigned GET for downloads) |
| IaC      | Pure CloudFormation (`infra/template.yaml`), `scripts/deploy.sh` |

No other AWS services, queues, workers, or databases are used — per the POC scope.

## Architecture

```
 Browser (Vue 3 + Vite)
   │ 1. Sign-up / sign-in via Cognito Hosted UI (OAuth2 code + PKCE)
   ▼
 Cognito User Pool ── groups: Agents / Customers (role = member of Agents?)
   │ 2. id_token (JWT) in Authorization header
   ▼
 API Gateway HTTP API ── JWT authorizer (all 7 routes)
   │ 3. Lambda proxy integration
   ▼
 Lambda (Node.js 20, single function, internal router)
   ├──► DynamoDB  tickets table (+ CustomerIndex GSI)
   ├──► DynamoDB  comments table
   └──► S3        presigned PUT/GET URLs (browser uploads directly to S3)
```

Ticket flow: create → list/filter → detail → status/assignee updates →
comments, with every change recorded in the ticket's `activity` timeline.

## AWS services used

- **Cognito User Pool + Hosted UI** — sign-up/sign-in; two groups, `Agents` and
  `Customers`. The Lambda derives the role from the `cognito:groups` JWT claim.
- **API Gateway HTTP API** — 7 routes, all with `AuthorizationType: JWT`.
- **Lambda (nodejs20.x)** — one function, `src/handler.handler`, routes on
  method + path.
- **DynamoDB** — `tickets` table (PK `ticketId`, GSI `CustomerIndex` on
  `customerId`/`createdAt`) and `comments` table (PK `ticketId`, SK `commentId`),
  both `PAY_PER_REQUEST`.
- **S3** — private attachments bucket with CORS allowing PUT from the frontend
  origin; uploads and downloads use presigned URLs (15 min expiry).

## Backend configuration

`infra/template.yaml` is pure CloudFormation (no SAM transform) and defines,
in order: parameters (`ProjectName`, `FrontendUrl`, `CognitoDomainPrefix`,
`LambdaCodeBucket`, `LambdaCodeKey`) → Cognito User Pool / app client /
domain / `Agents` + `Customers` groups → the two DynamoDB tables → the S3
bucket → the Lambda execution role (CloudWatch Logs, DynamoDB CRUD on both
tables + the GSI, S3 Put/Get on the bucket) → the Lambda function (env vars
`TICKETS_TABLE`, `COMMENTS_TABLE`, `ATTACHMENTS_BUCKET`) → the HTTP API with
CORS → the JWT authorizer → one shared Lambda proxy integration → the 7
routes → the `$default` stage → the Lambda invoke permission → stack outputs.

`scripts/deploy.sh` packages the backend (`npm ci --omit=dev`, zips `src/` +
`node_modules/` so the handler resolves as `src/handler.handler`), uploads the
zip to your staging bucket, then runs `aws cloudformation deploy` with the
required parameters and prints the stack outputs. `scripts/destroy.sh` empties
the attachments bucket and deletes the stack.

## Setup / run instructions

Prereqs: an AWS account, AWS CLI v2 configured, Node.js 20+, `zip`.

1. Deploy the backend:
   ```bash
   COGNITO_DOMAIN_PREFIX=<globally-unique-prefix> \
   STAGING_BUCKET=<a-bucket-you-own> \
   ./scripts/deploy.sh
   ```
   Optional: `STACK_NAME`, `AWS_REGION` (default `us-east-1`),
   `FRONTEND_URL` (default `http://localhost:5173`).
2. Sign up in the app (you'll be redirected to the Cognito Hosted UI).
   New users land in no group → they are **customers**.
3. Promote a user to **agent** (no Lambda trigger in this POC — one CLI call):
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <UserPoolId output> \
     --username <user-email> \
     --group-name Agents --region <region>
   ```
   (Sign the user out/in afterwards so the new group lands in the id_token.)
4. Configure the frontend from the stack outputs:
   ```bash
   cp frontend/.env.example frontend/.env
   # fill in VITE_API_URL, VITE_COGNITO_DOMAIN, VITE_COGNITO_CLIENT_ID, ...
   ```

### How to run the frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> frontend/dist/
```

## API endpoints

All endpoints require `Authorization: Bearer <Cognito id_token>` and sit behind
the JWT authorizer. Customers are scoped to their own tickets (`customerId ==
sub`); agents see everything.

| Method | Path                              | Description |
|--------|-----------------------------------|-------------|
| POST   | `/tickets`                        | Create ticket → `201 {ticket}`. Body: `title*`, `description*`, `priority*` (`low\|medium\|high\|urgent`), `category*`, `attachments?` |
| GET    | `/tickets?status=&priority=`      | List tickets → `200 {tickets, count}` (newest first) |
| GET    | `/tickets/{ticketId}`             | Ticket detail incl. `activity` + attachments with presigned `downloadUrl` |
| PUT    | `/tickets/{ticketId}`             | Update `status`, `assignee`, `title`, `description`, `priority`, `category`; logs activity entries |
| POST   | `/tickets/{ticketId}/comments`    | Add comment → `201 {comment}`. Body: `text*`; also logs `comment_added` activity |
| GET    | `/tickets/{ticketId}/comments`    | `200 {comments}` sorted oldest first |
| POST   | `/tickets/presigned-url`          | Presigned S3 PUT URL → `200 {uploadUrl, key, fileName, expiresIn}`. Body: `ticketId?`, `fileName*`, `contentType*`, `size?` (max 10MB) |

Errors are `{message}` with status 400 / 401 / 403 / 404 / 500.

## DynamoDB design

**Tickets table** (`<project>-tickets`, PK `ticketId` S; GSI `CustomerIndex`:
PK `customerId` S, SK `createdAt` S):

```
ticketId, title, description, priority, category,
status (open|in-progress|resolved|closed, default open),
assignee (string|null), customerId (Cognito sub), customerEmail,
attachments [{key, fileName, contentType, size, uploadedAt}],
activity    [{at, by, byEmail, role, action, detail}],
createdAt, updatedAt
```

**Comments table** (`<project>-comments`, PK `ticketId` S, SK `commentId` S):

```
commentId ("${ISO timestamp}_${rand}" -> chronological sort order),
ticketId, authorId, authorEmail, authorRole, text, createdAt
```

Access patterns: customer list = `Query` on `CustomerIndex` (efficient, no
scan); agent list = `Scan` with in-Lambda filters (fine for POC scale);
detail/comments = `Get`/`Query` by key. Updates use read-modify-write via
`Get`+`Put` to append `activity` entries atomically enough for POC load.

## Notes / limitations

- Built for the AWS Free Tier as far as the requirements allow (Lambda,
  API Gateway, DynamoDB on-demand, S3 and Cognito all have free-tier coverage;
  actual eligibility depends on your account usage).
- Attachments are capped at 10MB each; presigned URLs expire after 15 minutes.
- Roles come from Cognito groups; promoting a user to agent is a manual
  `admin-add-user-to-group` call (documented above).
- **Not verified live in this environment**: this repo was built and tested in a
  sandbox with no AWS credentials, so the Cognito Hosted UI sign-up/sign-in,
  the API Gateway → Lambda wiring, the JWT authorizer, S3 uploads, and the
  full end-to-end flow were not exercised against real AWS. Verified instead:
  `vite build` succeeds; 36/36 backend unit tests pass against in-memory
  DynamoDB/S3 fakes; `infra/template.yaml` passes `cfn-lint` with zero errors.
  Deploy with `scripts/deploy.sh` and walk the customer/agent flows to confirm.

## UI overview

The frontend is a SaaS-style helpdesk dashboard (Vue 3 + Tailwind CSS v4, no
extra UI libraries):

- **App shell** (`src/App.vue`): slim left sidebar + top bar + workspace.
  The sidebar is role-aware and drives the dashboard purely through URL query
  params — no new backend functionality. Agents see Dashboard, All Tickets,
  My Tickets, Unassigned, Open, In Progress, Resolved plus a Categories section
  derived from loaded tickets; customers see a simplified set. `?status=`
  maps to the existing API `?status=` filter; `?view=mine` / `?view=unassigned`
  / `?category=` are applied client-side after the API response. On mobile the
  sidebar hides behind a hamburger toggle.
- **Dashboard** (`src/views/TicketList.vue`): stat cards (Total, Open,
  In Progress, Resolved) computed from a real unfiltered `GET /tickets`
  response — never hardcoded; client-side search over title/category applied
  after the API status/priority filters; table with short ticket ID, title,
  status/priority badges, category, assignee avatar, updated time; rows open
  the detail page.
- **Ticket detail**: header with badges, info card, agent-only management
  section (rendered only when the Cognito `Agents` group role is `agent`),
  activity timeline, comments, and attachment download cards.
- **Create ticket**: same fields and the same S3 presigned-URL upload flow
  (10MB-per-file limit enforced client-side and server-side); selected files
  render as file cards; success navigates to the new ticket.
- **Login**: branded page that still just calls the existing PKCE `login()`
  redirect to the Cognito Hosted UI — no custom auth. The top bar always shows
  the current role (**Agent**/**Customer**) derived from `cognito:groups`.

A small Tailwind `@layer components` design system lives in
`src/style.css` (`.btn`, `.card`, `.badge-*`, `.input/.select/.textarea`,
`.tbl`, `.nav-link`, `.empty-state`, `.spinner`, `.alert-*`).

## Agent bootstrap (one-time)

`scripts/ensure-agent.ps1` (PowerShell — the team runs Windows) idempotently
ensures a user belongs to the Cognito `Agents` group. The app keeps deriving
the role from the `cognito:groups` JWT claim, so this is the only setup step;
there is no frontend role switcher and no password handling anywhere.

```powershell
# after deploying the backend, with the UserPoolId stack output:
.\scripts\ensure-agent.ps1 -UserPoolId <UserPoolId>
# optional: -Email someone@example.com -Region eu-west-1
# default email: ashok.fun99@gmail.com ; default region: us-east-1
```

Behavior: if the user does not exist yet, the script prints instructions
(sign up once via the app's Hosted UI, then re-run) and creates nothing; if
already in `Agents`, it reports that; otherwise it adds them. The user must
sign out/in afterwards for the new group to land in the id token.

## Demo: seeding 200 dummy tickets (optional)

`scripts/seed-dummy-tickets.js` (Node.js, AWS SDK v3) inserts 200 realistic
demo tickets into the existing DynamoDB tickets table for presentations. It
creates **no infrastructure** and never touches Cognito users or groups: it
only writes ticket records for a real customer sub you supply, using the exact
ticket schema the backend writes (same fields, same status/priority values,
same activity format). Agent users see the seeded tickets normally; customer
isolation is unchanged.

Setup (once):

```bash
cd scripts && npm install
```

Seed (PowerShell, from the repo root — use the real Cognito `sub` of your
demo customer; find it in the Cognito console or from the app's id token):

```bash
node scripts/seed-dummy-tickets.js --customer-sub "<CUSTOMER_SUB>" --table "<TicketsTableName-output>"
```

Options: `--customer-email` (display only, default
`demo.customer@example.com`), `--region` (default `ap-southeast-2`), `--table`
or the `TICKETS_TABLE` env var (no default is guessed; get the name from the
`TicketsTableName` stack output). Credentials come from your AWS CLI
configuration — the script never accepts or stores secrets.

Idempotency: ticket IDs are deterministic (`demo-seed-0001` … `demo-seed-0200`)
and existing items are never overwritten. First run prints `200 created`;
re-running prints `0 created, 200 already exist`. Use `--dry-run` to preview
the generated tickets without any AWS calls.

Cleanup (removes only the seeded dummy tickets):

```bash
node scripts/seed-dummy-tickets.js --cleanup --table "<TicketsTableName-output>"
```

> **Warning:** cleanup deletes only tickets carrying the `seedBatch:
> "demo-seed-v1"` marker written by this script. It never deletes normal
> user-created tickets, even if an ID somehow collided. Real tickets are
> never modified or deleted by the seed or cleanup runs.

## Frontend hosting (S3 + CloudFront HTTPS)

The built Vue app is hosted on AWS next to the existing backend: the
**unchanged** S3 static-website `FrontendBucket` serves as the origin for a
**CloudFront distribution** that provides HTTPS (default `*.cloudfront.net`
certificate, no custom domain or ACM certificate needed):

- **New, additive resources** in `infra/template.yaml` (created only when the
  `DeployedFrontendUrl` parameter is non-empty): `FrontendDistribution`
  (CloudFront, `PriceClass_100`), plus new stack outputs
  `FrontendDistributionId` and `FrontendCloudFrontUrl`
  (e.g. `https://d123abc.cloudfront.net`). The existing `FrontendBucket`
  (website hosting + public-read policy) is **not modified** — CloudFront uses
  the bucket's website endpoint as a custom origin (HTTP between CloudFront
  and S3; `redirect-to-https` for viewers).
- **SPA fallback:** CloudFront custom error responses map 403/404 to
  `/index.html` with HTTP 200, so `/login`, `/callback`, `/tickets/<id>` etc.
  work on refresh and deep links.
- **Caching:** the AWS-managed `CachingDisabled` policy is used, so every
  request reaches the origin and a fresh `index.html` is always served after
  each deploy. A `/*` invalidation is still created after every deployment as
  a safety net (first 1,000 invalidation paths/month are free).
- Setting `DeployedFrontendUrl` to the `https://<dist>.cloudfront.net` URL
  **appends** (never replaces) it to the API Gateway and attachments-bucket
  CORS origins **and** — because it is HTTPS — to the Cognito callback/logout
  URLs (via the existing `FrontendUrlIsHttps` condition). `http://localhost:5173`
  keeps working for local development.
- **Cognito sign-in now works from the deployed URL**, since the callback URL
  is HTTPS.

Deploy it with `scripts/deploy-frontend.ps1` (run from the repo root on
Windows). It is self-driving and idempotent:

### Notes

The S3 website bucket is world-readable by design (public-read bucket
policy); only static build assets are served and the Vite bundle contains no
secrets (only public `VITE_*` config). If S3 Block Public Access is enabled
at the **account** level, the bucket-policy update will fail — this is a
personal account you control, so adjust account-level block only for this
purpose if needed. First-time CloudFront distribution deployment takes
~5-15 minutes to reach `Deployed` status; the site is not reachable until
then. CloudFront Free Tier (1 TB transfer + 10M requests/month, always free)
comfortably covers POC traffic.

Deploy it with `scripts/deploy-frontend.ps1` (run from the repo root on
Windows). It is self-driving and idempotent:

```powershell
.\scripts\deploy-frontend.ps1 [-StackName aws-ticketing-poc] [-Region ap-southeast-2] `
  [-ApiUrl <ApiUrl output>] [-CognitoDomain <CognitoDomain output>] [-CognitoClientId <UserPoolClientId output>]
```

1. If the CloudFront distribution does not exist yet, it first updates the
   stack with a placeholder URL so the bucket + distribution are created
   (Phase A).
2. It builds `frontend/` for production. Values come from
   `frontend/.env.production` when present, otherwise from the `-ApiUrl` /
   `-CognitoDomain` / `-CognitoClientId` parameters. The OAuth redirect
   (`<cloudfront-url>/callback`) and logout (`<cloudfront-url>`) URIs are
   always derived from the real CloudFront URL.
3. It runs `aws s3 sync frontend/dist s3://<frontend-bucket> --delete`,
   then creates a CloudFront `/*` invalidation.
4. It updates the stack's `DeployedFrontendUrl` to the real CloudFront URL
   (re-sending the stack's current parameter values, overriding only that
   one), which wires CORS and Cognito callback/logout URLs to the deployed
   origin. Re-running only re-syncs, re-invalidates, and no-ops the update.

Cost: S3 storage/requests for a few static files plus CloudFront requests —
well within Free Tier at POC scale (CloudFront: 1 TB transfer + 10M
requests/month always free; invalidations: first 1,000 paths/month free).

## Full deploy sequence (backend + hosted frontend)

```powershell
# 1. backend (bash/WSL/Git-Bash; or translate to the PowerShell equivalents)
COGNITO_DOMAIN_PREFIX=<unique> STAGING_BUCKET=<bucket> ./scripts/deploy.sh

# 2. one-time agent bootstrap
.\scripts\ensure-agent.ps1 -UserPoolId <UserPoolId output>

# 3. hosted frontend (S3 + CloudFront HTTPS)
.\scripts\deploy-frontend.ps1 -Region <region>

# 4. open the FrontendCloudFrontUrl output to browse the deployed UI
#    (Cognito sign-in works from the deployed HTTPS URL and on localhost)
```
