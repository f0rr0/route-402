import { env } from "@/lib/env";
import type { EncryptedPayload } from "@/lib/crypto";
import { decryptJson, deriveProjectKey, encryptJson } from "@/lib/crypto";

export function encryptCredentials(projectId: string, credentials: unknown): EncryptedPayload {
  const masterKey = env.ROUTE402_MASTER_KEY;
  if (!masterKey) {
    throw new Error("ROUTE402_MASTER_KEY is not set");
  }
  const key = deriveProjectKey(masterKey, projectId);
  return encryptJson(key, credentials);
}

export function decryptCredentials<T>(projectId: string, payload: EncryptedPayload): T {
  const masterKey = env.ROUTE402_MASTER_KEY;
  if (!masterKey) {
    throw new Error("ROUTE402_MASTER_KEY is not set");
  }
  const key = deriveProjectKey(masterKey, projectId);
  return decryptJson<T>(key, payload);
}
