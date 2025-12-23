import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { routingDecisions, routingRulesets } from "@/lib/db/schema";
import { listConnections } from "@/lib/facilitators/service";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const connections = await listConnections(projectId);
  const enabledConnections = connections.filter((item) => item.enabled).length;
  const healthyConnections = connections.filter(
    (item) => item.status === "ok"
  ).length;
  const errorConnections = connections.filter(
    (item) => item.status === "error"
  ).length;
  const lastCheckedAt = connections.reduce<Date | null>((latest, connection) => {
    if (!connection.lastCheckedAt) {
      return latest;
    }
    if (!latest || connection.lastCheckedAt > latest) {
      return connection.lastCheckedAt;
    }
    return latest;
  }, null);

  const latestRuleset = await db
    .select({
      version: routingRulesets.version,
      updatedAt: routingRulesets.updatedAt,
      enabled: routingRulesets.enabled,
    })
    .from(routingRulesets)
    .where(eq(routingRulesets.projectId, projectId))
    .orderBy(desc(routingRulesets.version))
    .limit(1);

  const recentDecisions = await db
    .select({
      id: routingDecisions.id,
      endpoint: routingDecisions.endpoint,
      ruleName: routingDecisions.ruleName,
      ok: routingDecisions.ok,
      latencyMs: routingDecisions.latencyMs,
      createdAt: routingDecisions.createdAt,
    })
    .from(routingDecisions)
    .where(eq(routingDecisions.projectId, projectId))
    .orderBy(desc(routingDecisions.createdAt))
    .limit(6);

  const ruleset = latestRuleset[0] ?? null;

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Monitor routing health, provider readiness, and request activity.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
            <CardDescription>Providers ready for routing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-semibold text-foreground">
              {enabledConnections}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {connections.length} enabled
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="success">{healthyConnections} healthy</Badge>
              <Badge variant="destructive">{errorConnections} errors</Badge>
              <Badge variant="default">
                {connections.length - healthyConnections - errorConnections}{" "}
                unknown
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {lastCheckedAt
                ? `Last checked ${lastCheckedAt.toLocaleString()}`
                : "No capability checks yet."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routing rules</CardTitle>
            <CardDescription>Latest DSL snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ruleset ? (
              <>
                <div className="text-3xl font-semibold text-foreground">
                  v{ruleset.version}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={ruleset.enabled ? "success" : "warning"}>
                    {ruleset.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <span>
                    Updated {ruleset.updatedAt.toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No ruleset published yet.
              </p>
            )}
            <Link
              href={`/projects/${projectId}/rules`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Edit ruleset
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facade endpoints</CardTitle>
            <CardDescription>Unified entry points for tenants.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm font-mono text-muted-foreground">
              <li>POST /api/facilitator/verify</li>
              <li>POST /api/facilitator/settle</li>
              <li>GET /api/facilitator/supported</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent routing decisions</CardTitle>
            <CardDescription>
              Latest verify/settle outcomes across providers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No routing decisions recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recentDecisions.map((decision) => (
                  <div
                    key={decision.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={decision.ok ? "success" : "destructive"}
                      >
                        {decision.ok ? "ok" : "error"}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {decision.endpoint}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rule {decision.ruleName ?? "default"}
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

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common project workflows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              href={`/projects/${projectId}/facilitators`}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Add facilitator
            </Link>
            <Link
              href={`/projects/${projectId}/rules`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Validate ruleset
            </Link>
            <Link
              href={`/projects/${projectId}/logs`}
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Review logs
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
