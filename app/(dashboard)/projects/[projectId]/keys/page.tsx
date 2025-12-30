import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import KeysClient from "./keys-client";
import type { ApiKeyListItem } from "./types";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.projectId, projectId))
    .orderBy(desc(apiKeys.createdAt));

  const serializedKeys: ApiKeyListItem[] = keys.map((key) => ({
    id: key.id,
    name: key.name,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Manage machine tokens used to call verify and settle.
        </p>
      </header>

      <KeysClient projectId={projectId} initialKeys={serializedKeys} />
    </div>
  );
}
