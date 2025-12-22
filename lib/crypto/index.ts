import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

export type EncryptedPayload = {
  version: number;
  nonce: string;
  ciphertext: string;
  tag: string;
};

const CURRENT_VERSION = 1;
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

export function deriveProjectKey(masterKeyBase64: string, projectId: string): Buffer {
  const masterKey = Buffer.from(masterKeyBase64, "base64");
  if (masterKey.length !== KEY_BYTES) {
    throw new Error("ROUTE402_MASTER_KEY must be 32 bytes base64");
  }
  return hkdfSync(
    "sha256",
    masterKey,
    Buffer.from(projectId, "utf8"),
    Buffer.from("route402", "utf8"),
    KEY_BYTES
  );
}

export function encryptJson(key: Buffer, value: unknown): EncryptedPayload {
  if (key.length !== KEY_BYTES) {
    throw new Error("Encryption key must be 32 bytes");
  }

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: CURRENT_VERSION,
    nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptJson<T>(key: Buffer, payload: EncryptedPayload): T {
  if (payload.version !== CURRENT_VERSION) {
    throw new Error("Unsupported encrypted payload version");
  }
  if (key.length !== KEY_BYTES) {
    throw new Error("Decryption key must be 32 bytes");
  }

  const nonce = Buffer.from(payload.nonce, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const tag = Buffer.from(payload.tag, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return JSON.parse(plaintext.toString("utf8")) as T;
}
