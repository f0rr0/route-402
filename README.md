# Route402

Route402 is a multi-tenant router/proxy for x402 facilitator APIs. It exposes a facilitator-compatible facade for verify, settle, and supported requests while routing traffic based on tenant-configured rules.

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
