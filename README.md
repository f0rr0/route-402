# Route402

Route402 is a multi-tenant router/proxy for x402 facilitator APIs. It exposes a facilitator-compatible facade for verify, settle, and supported requests while routing traffic based on tenant-configured rules.

## Architecture (high level)

- Next.js App Router API routes expose the facilitator facade:
  - `POST /api/facilitator/verify`
  - `POST /api/facilitator/settle`
  - `GET /api/facilitator/supported`
- Routing engine evaluates a YAML ruleset per tenant, after filtering eligible facilitator connections (enabled + capability support).
- Provider adapters (e.g. Coinbase CDP, thirdweb) normalize verify/settle/supported responses.
- Credentials are stored encrypted at rest (AES-256-GCM via per-project derived keys).
- RBAC is enforced server-side for all writes; viewers never see secrets.
- Trigger.dev runs background jobs for capability refresh and settlement reconciliation.
- Data lives in Neon Postgres; Upstash Redis is optional for cache/rate limiting.

## Request flow (concise)

### Verify
1. Receive x402 verify request.
2. Build routing context from `paymentRequirements`.
3. Filter eligible connections, evaluate rules, pick connection.
4. Call provider adapter `verify()` and return normalized result.
5. Optionally fall back to another eligible connection on transient failure.

### Settle
1. Receive x402 settle request.
2. Compute fingerprint from stable JSON of payload + requirements.
3. Use sticky routing: same fingerprint -> same connection.
4. Call provider adapter `settle()` and return normalized result.
5. On timeout/unknown, mark settlement as `unknown` and enqueue reconciliation.

### Supported
1. Aggregate provider `supported()` responses.
2. Return normalized capabilities for eligible connections.

## Local development (Bun)

```bash
bun install
bun run dev
```

## Scripts

```bash
bun run typecheck
bun run lint
bun test
```

## Environment

Copy `.env.example` to `.env` and fill in required values.

- `DATABASE_URL` for Neon Postgres (pooled, runtime)
- `DRIZZLE_DATABASE_URL` for migrations (non-pooled)
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` for Better Auth
- `ROUTE402_MASTER_KEY` for credentials encryption

## Database (Drizzle)

```bash
bun run db:generate
bun run db:migrate
```
