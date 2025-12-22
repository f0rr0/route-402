import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";

const API_KEY_PREFIX = "r402_";
const API_KEY_BYTES = 32;

export type ApiKeyRecord = {
  id: string;
  projectId: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

export function hashApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey() {
  const token = randomBytes(API_KEY_BYTES).toString("base64url");
  const rawKey = `${API_KEY_PREFIX}${token}`;
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyHash };
}

export function parseBearerToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const [scheme, token] = value.trim().split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

export async function createApiKey(params: {
  projectId: string;
  name: string;
}) {
  const { rawKey, keyHash } = generateApiKey();
  const rows = await db
    .insert(apiKeys)
    .values({
      projectId: params.projectId,
      name: params.name,
      keyHash,
    })
    .returning({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt,
    });

  return {
    key: rawKey,
    record: rows[0],
  };
}

export async function revokeApiKey(id: string) {
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .returning({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt,
    });

  return rows[0] ?? null;
}

export async function getApiKeyRecordByHash(keyHash: string) {
  const rows = await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt,
      keyHash: apiKeys.keyHash,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  return rows[0] ?? null;
}

export async function verifyApiKey(rawKey: string) {
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  const hash = hashApiKey(rawKey);
  const record = await getApiKeyRecordByHash(hash);
  if (!record) {
    return null;
  }

  const hashBuffer = Buffer.from(hash, "utf8");
  const recordBuffer = Buffer.from(record.keyHash, "utf8");
  if (hashBuffer.length !== recordBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(hashBuffer, recordBuffer)) {
    return null;
  }

  return record;
}

export async function markApiKeyUsed(id: string) {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id));
}

export async function authenticateApiKey(headers: Headers) {
  const token = parseBearerToken(headers.get("authorization"));
  if (!token) {
    return null;
  }

  const record = await verifyApiKey(token);
  if (!record) {
    return null;
  }

  await markApiKeyUsed(record.id);
  return record;
}
