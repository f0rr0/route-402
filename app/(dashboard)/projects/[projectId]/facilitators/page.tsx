import {
  createConnectionAction,
  testConnectionAction,
  toggleConnectionAction,
} from "./actions";
import { listConnections } from "@/lib/facilitators/service";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const statusVariant = (status: string | null) => {
  switch (status) {
    case "ok":
      return "success";
    case "error":
      return "destructive";
    default:
      return "default";
  }
};

export default async function FacilitatorsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const connections = await listConnections(projectId);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Facilitator connections
        </h1>
        <p className="text-sm text-muted-foreground">
          Add provider credentials and validate supported capabilities.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>
            Manage enabled providers and refresh capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No facilitator connections yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {connection.name}
                      </p>
                      <Badge variant={statusVariant(connection.status)}>
                        {connection.status ?? "unknown"}
                      </Badge>
                    </div>
                    <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                      {connection.provider}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {connection.lastCheckedAt
                        ? `Last checked ${connection.lastCheckedAt.toLocaleString()}`
                        : "Not checked yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <form action={testConnectionAction}>
                      <input
                        type="hidden"
                        name="projectId"
                        value={projectId}
                      />
                      <input
                        type="hidden"
                        name="connectionId"
                        value={connection.id}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        Test connection
                      </Button>
                    </form>
                    <form action={toggleConnectionAction}>
                      <input
                        type="hidden"
                        name="projectId"
                        value={projectId}
                      />
                      <input
                        type="hidden"
                        name="connectionId"
                        value={connection.id}
                      />
                      <input
                        type="hidden"
                        name="enabled"
                        value={(!connection.enabled).toString()}
                      />
                      <Button
                        type="submit"
                        variant={connection.enabled ? "secondary" : "default"}
                        size="sm"
                      >
                        {connection.enabled ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Coinbase CDP</CardTitle>
            <CardDescription>
              Stores credentials encrypted and validates with /supported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createConnectionAction} className="space-y-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="provider" value="cdp" />

              <div className="space-y-2">
                <Label htmlFor="cdp-name">Name</Label>
                <Input
                  id="cdp-name"
                  name="name"
                  placeholder="cdp-base"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cdp-api-key">API key</Label>
                <Input id="cdp-api-key" name="cdpApiKey" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cdp-api-secret">API secret</Label>
                <Input
                  id="cdp-api-secret"
                  name="cdpApiSecret"
                  type="password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cdp-base-url">Base URL (optional)</Label>
                <Input
                  id="cdp-base-url"
                  name="cdpBaseUrl"
                  placeholder="https://api.cdp.coinbase.com"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="enabled" defaultChecked />
                Enable connection
              </label>

              <Button type="submit">Save CDP connection</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add thirdweb Nexus</CardTitle>
            <CardDescription>
              Stores wallet secret encrypted and validates with /supported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createConnectionAction} className="space-y-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="provider" value="thirdweb" />

              <div className="space-y-2">
                <Label htmlFor="thirdweb-name">Name</Label>
                <Input
                  id="thirdweb-name"
                  name="name"
                  placeholder="thirdweb-prod"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thirdweb-secret">Wallet secret</Label>
                <Input
                  id="thirdweb-secret"
                  name="thirdwebWalletSecret"
                  type="password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thirdweb-base-url">Base URL (optional)</Label>
                <Input
                  id="thirdweb-base-url"
                  name="thirdwebBaseUrl"
                  placeholder="https://api.thirdweb.com"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="enabled" defaultChecked />
                Enable connection
              </label>

              <Button type="submit">Save thirdweb connection</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
