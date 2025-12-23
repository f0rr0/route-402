import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { facilitatorConnections, routingDecisions } from "@/lib/db/schema";

export default async function LogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const decisions = await db
    .select({
      id: routingDecisions.id,
      endpoint: routingDecisions.endpoint,
      ok: routingDecisions.ok,
      ruleName: routingDecisions.ruleName,
      latencyMs: routingDecisions.latencyMs,
      createdAt: routingDecisions.createdAt,
      connectionName: facilitatorConnections.name,
    })
    .from(routingDecisions)
    .leftJoin(
      facilitatorConnections,
      eq(routingDecisions.connectionId, facilitatorConnections.id)
    )
    .where(eq(routingDecisions.projectId, projectId))
    .orderBy(desc(routingDecisions.createdAt))
    .limit(50);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Recent routing decisions with latency and rule metadata.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Routing decisions</CardTitle>
          <CardDescription>Latest 50 requests recorded.</CardDescription>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No routing activity recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={decision.ok ? "success" : "destructive"}>
                      {decision.ok ? "ok" : "error"}
                    </Badge>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {decision.endpoint}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {decision.connectionName ?? "Unassigned"} - Rule{" "}
                        {decision.ruleName ?? "default"}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {decision.latencyMs ? `${decision.latencyMs}ms` : "-"} -{" "}
                    {decision.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
