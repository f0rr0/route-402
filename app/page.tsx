export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-20">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Route402
          </p>
          <h1 className="text-4xl font-semibold">
            Multi-tenant x402 facilitator router proxy.
          </h1>
          <p className="text-lg text-muted-foreground">
            Configure providers, define routing rules, and send verify or settle
            requests through a single facade.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-muted/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Facilitator facade
          </h2>
          <ul className="mt-4 space-y-2 font-mono text-sm text-foreground">
            <li>POST /api/facilitator/verify</li>
            <li>POST /api/facilitator/settle</li>
            <li>GET /api/facilitator/supported</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
