import Link from "next/link";
import { and, desc, eq, gte, ilike } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { db } from "@/lib/db";
import { facilitatorConnections, routingDecisions } from "@/lib/db/schema";

type SearchParams = {
  endpoint?: string | string[];
  status?: string | string[];
  connectionId?: string | string[];
  rule?: string | string[];
  range?: string | string[];
};

function getParam(value?: string | string[]) {
  if (!value) {
    return "";
  }
  return Array.isArray(value) ? value[0] ?? "" : value;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)
  );
  return sorted[idx];
}

function formatLatency(value: number | null) {
  if (value === null) {
    return "-";
  }
  return `${value}ms`;
}

export default async function LogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { projectId } = await params;
  const filters = await searchParams;

  const endpointFilter = getParam(filters?.endpoint);
  const statusFilter = getParam(filters?.status);
  const connectionFilter = getParam(filters?.connectionId);
  const ruleFilterRaw = getParam(filters?.rule).trim().slice(0, 64);
  const rangeFilter = getParam(filters?.range);

  const rangeStart =
    rangeFilter === "24h"
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : rangeFilter === "7d"
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        : rangeFilter === "30d"
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          : null;

  const connectionRows = await db
    .select({
      id: facilitatorConnections.id,
      name: facilitatorConnections.name,
      provider: facilitatorConnections.provider,
    })
    .from(facilitatorConnections)
    .where(eq(facilitatorConnections.projectId, projectId))
    .orderBy(facilitatorConnections.createdAt);

  const conditions = [eq(routingDecisions.projectId, projectId)];

  if (endpointFilter === "verify" || endpointFilter === "settle") {
    conditions.push(eq(routingDecisions.endpoint, endpointFilter));
  }

  if (statusFilter === "ok") {
    conditions.push(eq(routingDecisions.ok, true));
  } else if (statusFilter === "error") {
    conditions.push(eq(routingDecisions.ok, false));
  }

  if (connectionFilter && UUID_REGEX.test(connectionFilter)) {
    conditions.push(eq(routingDecisions.connectionId, connectionFilter));
  }

  if (ruleFilterRaw) {
    conditions.push(ilike(routingDecisions.ruleName, `%${ruleFilterRaw}%`));
  }

  if (rangeStart) {
    conditions.push(gte(routingDecisions.createdAt, rangeStart));
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const decisions = await db
    .select({
      id: routingDecisions.id,
      endpoint: routingDecisions.endpoint,
      ok: routingDecisions.ok,
      ruleName: routingDecisions.ruleName,
      requestId: routingDecisions.requestId,
      errorCode: routingDecisions.errorCode,
      latencyMs: routingDecisions.latencyMs,
      createdAt: routingDecisions.createdAt,
      connectionName: facilitatorConnections.name,
    })
    .from(routingDecisions)
    .leftJoin(
      facilitatorConnections,
      eq(routingDecisions.connectionId, facilitatorConnections.id)
    )
    .where(whereClause)
    .orderBy(desc(routingDecisions.createdAt))
    .limit(200);

  const displayDecisions = decisions.slice(0, 50);
  const okCount = decisions.filter((decision) => decision.ok).length;
  const errorCount = decisions.length - okCount;
  const successRate = decisions.length
    ? Math.round((okCount / decisions.length) * 100)
    : 0;

  const latencyValues = decisions
    .map((decision) => decision.latencyMs)
    .filter((latency): latency is number => typeof latency === "number");
  const avgLatency = latencyValues.length
    ? Math.round(
        latencyValues.reduce((sum, value) => sum + value, 0) /
          latencyValues.length
      )
    : null;
  const p50Latency = percentile(latencyValues, 0.5);
  const p95Latency = percentile(latencyValues, 0.95);

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
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine the decision stream.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Select id="endpoint" name="endpoint" defaultValue={endpointFilter}>
                <option value="">All</option>
                <option value="verify">verify</option>
                <option value="settle">settle</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={statusFilter}>
                <option value="">All</option>
                <option value="ok">ok</option>
                <option value="error">error</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="connectionId">Connection</Label>
              <Select
                id="connectionId"
                name="connectionId"
                defaultValue={connectionFilter}
              >
                <option value="">All</option>
                {connectionRows.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} ({connection.provider})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="range">Range</Label>
              <Select id="range" name="range" defaultValue={rangeFilter}>
                <option value="">All</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule">Rule name</Label>
              <Input
                id="rule"
                name="rule"
                placeholder="default"
                defaultValue={ruleFilterRaw}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full">
                Apply
              </Button>
              <Link
                href={`/projects/${projectId}/logs`}
                className={`${buttonVariants({ variant: "outline" })} w-full`}
              >
                Reset
              </Link>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Sample: last {decisions.length} entries</span>
            {endpointFilter ? (
              <Badge variant="default">endpoint: {endpointFilter}</Badge>
            ) : null}
            {statusFilter ? (
              <Badge variant="default">status: {statusFilter}</Badge>
            ) : null}
            {connectionFilter ? (
              <Badge variant="default">connection: {connectionFilter.slice(0, 8)}...</Badge>
            ) : null}
            {rangeFilter ? (
              <Badge variant="default">range: {rangeFilter}</Badge>
            ) : null}
            {ruleFilterRaw ? (
              <Badge variant="default">rule: {ruleFilterRaw}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Total decisions
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {decisions.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {okCount} ok / {errorCount} error
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Success rate
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {decisions.length ? `${successRate}%` : "-"}
            </p>
            <p className="text-xs text-muted-foreground">Sampled logs only</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Latency p50
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatLatency(p50Latency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Avg {formatLatency(avgLatency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Latency p95
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatLatency(p95Latency)}
            </p>
            <p className="text-xs text-muted-foreground">Latest window</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Routing decisions</CardTitle>
          <CardDescription>Latest 50 requests recorded.</CardDescription>
        </CardHeader>
        <CardContent>
          {displayDecisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No routing activity recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {displayDecisions.map((decision) => (
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
                      {decision.errorCode ? (
                        <p className="text-xs text-muted-foreground">
                          Error {decision.errorCode}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatLatency(decision.latencyMs)} -{" "}
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
