# AGENTS.md - Route402

This file tells coding agents how to work in the Route402 repo safely and consistently.

## Project summary

Route402 is a multi-tenant router/proxy for x402 facilitator APIs. It exposes a facilitator-compatible facade:
- `POST /api/facilitator/verify`
- `POST /api/facilitator/settle`
- `GET /api/facilitator/supported`

Tenants (projects) connect one or more facilitator providers by entering credentials in the dashboard. Route402 evaluates a YAML DSL ruleset to pick which facilitator connection to use for each request.

### MVP providers
- Coinbase CDP hosted x402 facilitator (Base/USDC focus)
- thirdweb Nexus facilitator (broad EVM support)

## Tech stack

- Next.js (App Router), Vercel Serverless
- TypeScript **strict**
- Bun for local tooling (tests/scripts)
- Neon Postgres (primary DB)
- Upstash Redis (optional cache + rate limits)
- Trigger.dev for background jobs (health checks, capability refresh, settle reconciliation)
- UI: Tailwind + **shadcn/ui** components (Radix-based)

## Non-negotiables

1) Do not log secrets, auth headers, or full payment payloads.
2) Credentials stored in DB must be encrypted at rest (AES-256-GCM).
3) `/settle` must be idempotent + sticky to one facilitator for a given fingerprint.
4) Strict TypeScript: avoid `any`. Prefer discriminated unions and Zod inference.
5) RBAC must be enforced server-side on every write.

## Local dev commands (Bun)

- Install deps: `bun install`
- Dev server: `bun run dev`
- Typecheck: `bun run typecheck`
- Lint: `bun run lint`
- Test: `bun test`

DB / migrations (depending on chosen ORM):
- Drizzle:
  - Generate: `bun run db:generate`
  - Migrate: `bun run db:migrate`

Trigger.dev:
- `bun run trigger:dev`

> Keep scripts in `package.json` consistent with these names.

## Repository structure (expected)

- `app/`
  - `api/facilitator/verify/route.ts`
  - `api/facilitator/settle/route.ts`
  - `api/facilitator/supported/route.ts`
  - `(dashboard)/...` shadcn UI pages

- `components/`
  - `ui/` (shadcn generated components)
  - app-specific components (cards, switchers, forms)

- `lib/`
  - `auth/` (Auth.js / session helpers)
  - `rbac/` (role checks + permission mapping)
  - `db/` (Neon + ORM client, schema)
  - `crypto/` (AES-GCM encryption, HKDF key derivation)
  - `facilitators/` (cdp adapter, thirdweb adapter)
  - `routing/` (DSL parse/validate/eval, context extraction)
  - `obs/` (logging, metrics helpers)
  - `types/` (x402 request/response types)

## Roles and access control (RBAC)

We use 3 org-level roles:
- `owner`: full control (members/roles, billing later, all project settings, credentials, keys)
- `admin`: operational control (manage projects, rules, connections, API keys), no org role changes
- `viewer`: read-only (view rules, connections status, logs), no secrets, no writes

RBAC rules:
- Enforce RBAC in server code (route handlers / server actions), never trust client-side checks.
- Viewer may see connection metadata (name, provider, enabled, status), but never credentials.
- Credentials are write-only: can set/rotate, never reveal.

## Security & secrets

### Credential storage
Facilitator credentials are stored encrypted:
- Env var: `ROUTE402_MASTER_KEY` (32 bytes base64)
- Derive per-project key via HKDF(master, projectId)
- Encrypt/decrypt JSON with AES-256-GCM
- Store: `{ version, nonce, ciphertext, tag }`

Never persist decrypted credentials. Decrypt only inside request scope in memory.

### Machine API keys
- Create: `r402_<random>`
- Store only `sha256(rawKey)` as `key_hash`
- Show raw key only once on creation

### Logging policy
Allowed to log:
- projectId/orgId
- chosen facilitator connection id
- rule name
- endpoint (verify/settle)
- latency ms
- status (ok/error code)
- fingerprint hashes (not raw payload)

Never log:
- Authorization headers
- facilitator credentials
- full payment payload
- user PII beyond email (if needed for audit)

## Routing DSL (YAML)

Rulesets are YAML, ordered, first match wins:
- `default: "<connectionName>"`
- `rules[]` with `{ name, when, then: { use: "<connectionName>" } }`

Allowed boolean operators:
- `all`, `any`, `not`

Allowed predicates:
- `eq: [var, value]`
- `in: [var, [values...]]`
- `lte/gte: [var, number]` (optional)

No arbitrary execution. No regex in MVP.

Routing context variables derived from `paymentRequirements`:
- `scheme`
- `network` (normalize if possible)
- `asset` (symbol or address)
- `amount` (string)
- `payTo`
- `endpoint` ("verify" | "settle")

Before applying rules, filter eligible connections:
- enabled
- supports `(scheme, network)` (capability cache)

If rule selects ineligible connection:
- `verify`: fallback to default eligible (configurable)
- `settle`: error (do not attempt settlement with unknown capability)

Explainability:
Return headers:
- `x-route402-connection`
- `x-route402-rule`

## Dataplane semantics

### `/verify`
- May fall back to another eligible facilitator on transient failure.
- Never fall back if request would change semantics (keep MVP conservative).

### `/settle`
- Compute fingerprint: `sha256(stableJson({ paymentPayload, paymentRequirements }))`
- Sticky route: same fingerprint always uses same connection
- No blind fallback. On timeout/unknown:
  - mark settlement state as `unknown`
  - return 503 with requestId
  - enqueue Trigger.dev reconciliation

## Facilitator adapter contract

All providers implement:
- `supported()`
- `verify()`
- `settle()`

Normalize responses into:
- `VerifyResNormalized { isValid, payer?, invalidReason? }`
- `SettleResNormalized { success, payer?, txHash?, network?, errorReason? }`

Add new provider by:
1) Implement adapter module in `lib/facilitators/<provider>.ts`
2) Add credential schema in `lib/types/credentials.ts` (Zod)
3) Add dashboard form in `(dashboard)/facilitators`
4) Extend capability refresh job

## Trigger.dev jobs

- Capability refresh:
  - on connection save
  - scheduled (e.g., every 6h)
  - writes `facilitator_capabilities`

- Settlement reconciliation:
  - for `unknown` settlement states
  - retries settle idempotently against same connection or checks status if provider supports it

## UI (shadcn)

- shadcn components are under `components/ui/*`.
- Use Tailwind for layout and spacing.
- Prefer:
  - `react-hook-form` + `zodResolver`
  - inline error messages
  - toasts for async results ("connection tested", "rules validated")
- Never display secrets after saving. Use "Replace secret" only.

## Testing expectations

Minimum tests:
- DSL evaluator unit tests (truth table for operators)
- Settle idempotency tests (same fingerprint routes same connection)
- RBAC tests for key actions (viewer cannot write, admin cannot change roles)

## PR checklist (agent must verify)

- TypeScript strict passes
- No secrets logged or returned
- RBAC enforced on all writes
- `/settle` idempotency preserved
- Ruleset validation prevents invalid connection references
- UI uses shadcn components (no bespoke component library)
