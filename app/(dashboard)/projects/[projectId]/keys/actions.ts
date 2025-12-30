"use server";

import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createApiKey,
  revokeApiKey,
  type ApiKeyRecord,
} from "@/lib/auth/api-keys";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { authorizeOrRedirect } from "@/lib/rbac/authorize";
import { BadRequestError, NotFoundError } from "@/lib/rbac/errors";
import type { ApiKeyListItem } from "./types";

const createSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(64),
});

const revokeSchema = z.object({
  projectId: z.string().uuid(),
  keyId: z.string().uuid(),
});

const rotateSchema = revokeSchema;

function serializeKey(record: ApiKeyRecord): ApiKeyListItem {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
  };
}

export type CreateApiKeyResult =
  | { ok: true; key: string; record: ApiKeyListItem }
  | { ok: false; error: string };

export type RevokeApiKeyResult =
  | { ok: true; record: ApiKeyListItem }
  | { ok: false; error: string };

export type RotateApiKeyResult =
  | {
      ok: true;
      key: string;
      record: ApiKeyListItem;
      revoked: ApiKeyListItem;
    }
  | { ok: false; error: string };

export async function createApiKeyAction(
  input: z.infer<typeof createSchema>
): Promise<CreateApiKeyResult> {
  try {
    const payload = createSchema.parse(input);
    const requestHeaders = await headers();
    await authorizeOrRedirect({
      headers: requestHeaders,
      projectId: payload.projectId,
      minRole: "admin",
    });

    const { key, record } = await createApiKey({
      projectId: payload.projectId,
      name: payload.name,
    });

    revalidatePath(`/projects/${payload.projectId}/keys`);
    return { ok: true, key, record: serializeKey(record) };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Failed to create key";
    return { ok: false, error: message };
  }
}

export async function revokeApiKeyAction(
  input: z.infer<typeof revokeSchema>
): Promise<RevokeApiKeyResult> {
  try {
    const payload = revokeSchema.parse(input);
    const requestHeaders = await headers();
    await authorizeOrRedirect({
      headers: requestHeaders,
      projectId: payload.projectId,
      minRole: "admin",
    });

    const record = await revokeApiKey(payload.keyId);
    if (!record) {
      throw new NotFoundError("Key not found");
    }

    revalidatePath(`/projects/${payload.projectId}/keys`);
    return { ok: true, record: serializeKey(record) };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Failed to revoke key";
    return { ok: false, error: message };
  }
}

export async function rotateApiKeyAction(
  input: z.infer<typeof rotateSchema>
): Promise<RotateApiKeyResult> {
  try {
    const payload = rotateSchema.parse(input);
    const requestHeaders = await headers();
    await authorizeOrRedirect({
      headers: requestHeaders,
      projectId: payload.projectId,
      minRole: "admin",
    });

    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(
        and(eq(apiKeys.id, payload.keyId), eq(apiKeys.projectId, payload.projectId))
      )
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new NotFoundError("Key not found");
    }

    if (existing.revokedAt) {
      throw new BadRequestError("Key is already revoked");
    }

    const rotatedName = `${existing.name} (rotated ${new Date()
      .toISOString()
      .slice(0, 10)})`;

    const { key, record } = await createApiKey({
      projectId: payload.projectId,
      name: rotatedName,
    });

    const revoked = await revokeApiKey(existing.id);
    if (!revoked) {
      throw new Error("Failed to revoke previous key");
    }

    revalidatePath(`/projects/${payload.projectId}/keys`);
    return {
      ok: true,
      key,
      record: serializeKey(record),
      revoked: serializeKey(revoked),
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Failed to rotate key";
    return { ok: false, error: message };
  }
}
