import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  facilitatorCapabilities,
  facilitatorConnections,
} from "@/lib/db/schema";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto/credentials";
import type { EncryptedPayload } from "@/lib/crypto";
import {
  credentialsSchemaByProvider,
  facilitatorProviderSchema,
  type FacilitatorProvider,
} from "@/lib/types/credentials";
import { getAdapter } from "@/lib/facilitators";
import { NotFoundError } from "@/lib/rbac/errors";

export type FacilitatorConnectionSummary = {
  id: string;
  name: string;
  provider: FacilitatorProvider;
  enabled: boolean;
  status: "unknown" | "ok" | "error" | null;
  lastCheckedAt: Date | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
};

export async function listConnections(projectId: string) {
  return db
    .select({
      id: facilitatorConnections.id,
      name: facilitatorConnections.name,
      provider: facilitatorConnections.provider,
      enabled: facilitatorConnections.enabled,
      status: facilitatorCapabilities.status,
      lastCheckedAt: facilitatorCapabilities.lastCheckedAt,
      latencyP50Ms: facilitatorCapabilities.latencyP50Ms,
      latencyP95Ms: facilitatorCapabilities.latencyP95Ms,
    })
    .from(facilitatorConnections)
    .leftJoin(
      facilitatorCapabilities,
      eq(facilitatorCapabilities.connectionId, facilitatorConnections.id)
    )
    .where(eq(facilitatorConnections.projectId, projectId))
    .orderBy(facilitatorConnections.createdAt);
}

export async function createConnection(params: {
  projectId: string;
  provider: FacilitatorProvider;
  name: string;
  enabled: boolean;
  credentials: unknown;
}) {
  const provider = facilitatorProviderSchema.parse(params.provider);
  const schema = credentialsSchemaByProvider[provider];
  const parsedCredentials = schema.parse(params.credentials);
  const encrypted = encryptCredentials(params.projectId, parsedCredentials);

  const rows = await db
    .insert(facilitatorConnections)
    .values({
      projectId: params.projectId,
      provider,
      name: params.name,
      enabled: params.enabled,
      credentialsEnc: encrypted,
      updatedAt: new Date(),
    })
    .returning({ id: facilitatorConnections.id });

  const connectionId = rows[0]?.id;
  if (connectionId) {
    await db
      .insert(facilitatorCapabilities)
      .values({
        connectionId,
        supportedJson: {},
        status: "unknown",
        lastCheckedAt: null,
      })
      .onConflictDoNothing();
  }

  return connectionId;
}

export async function setConnectionEnabled(params: {
  projectId: string;
  connectionId: string;
  enabled: boolean;
}) {
  const rows = await db
    .update(facilitatorConnections)
    .set({ enabled: params.enabled, updatedAt: new Date() })
    .where(
      and(
        eq(facilitatorConnections.id, params.connectionId),
        eq(facilitatorConnections.projectId, params.projectId)
      )
    )
    .returning({ id: facilitatorConnections.id });

  return rows[0] ?? null;
}

export async function testConnection(params: {
  projectId: string;
  connectionId: string;
}) {
  const rows = await db
    .select({
      id: facilitatorConnections.id,
      provider: facilitatorConnections.provider,
      credentialsEnc: facilitatorConnections.credentialsEnc,
    })
    .from(facilitatorConnections)
    .where(
      and(
        eq(facilitatorConnections.id, params.connectionId),
        eq(facilitatorConnections.projectId, params.projectId)
      )
    )
    .limit(1);

  const connection = rows[0];
  if (!connection) {
    throw new NotFoundError("Connection not found");
  }

  const credentials = decryptCredentials(
    params.projectId,
    connection.credentialsEnc as EncryptedPayload
  );

  const adapter = getAdapter(connection.provider as FacilitatorProvider);
  const startedAt = Date.now();

  try {
    const supported = await adapter.supported({
      projectId: params.projectId,
      connectionId: connection.id,
      provider: connection.provider as FacilitatorProvider,
      credentials: credentials as Record<string, unknown>,
    });

    const latencyMs = Date.now() - startedAt;
    const { rawProvider: _rawProvider, ...safeSupported } = supported;

    await db
      .insert(facilitatorCapabilities)
      .values({
        connectionId: connection.id,
        supportedJson: safeSupported,
        status: "ok",
        lastCheckedAt: new Date(),
        latencyP50Ms: latencyMs,
        latencyP95Ms: latencyMs,
      })
      .onConflictDoUpdate({
        target: facilitatorCapabilities.connectionId,
        set: {
          supportedJson: safeSupported,
          status: "ok",
          lastCheckedAt: new Date(),
          latencyP50Ms: latencyMs,
          latencyP95Ms: latencyMs,
        },
      });

    return { status: "ok" as const, latencyMs };
  } catch (error) {
    await db
      .insert(facilitatorCapabilities)
      .values({
        connectionId: connection.id,
        supportedJson: {},
        status: "error",
        lastCheckedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: facilitatorCapabilities.connectionId,
        set: {
          status: "error",
          lastCheckedAt: new Date(),
          supportedJson: sql`facilitator_capabilities.supported_json`,
        },
      });

    throw error;
  }
}
