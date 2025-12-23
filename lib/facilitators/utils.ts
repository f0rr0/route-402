import type { SupportedResponse } from "@/lib/facilitators/types";
import type { SettleResNormalized, VerifyResNormalized } from "@/lib/types/x402";

type UnknownRecord = Record<string, unknown>;

const VERIFY_BOOL_KEYS = ["isValid", "valid", "verified", "success"];
const SETTLE_BOOL_KEYS = ["success", "settled", "ok"];
const PAYER_KEYS = ["payer", "payerAddress", "payer_address"];
const INVALID_KEYS = ["invalidReason", "reason", "error", "message"];
const SETTLE_ERROR_KEYS = ["errorReason", "reason", "error", "message"];
const TX_HASH_KEYS = ["txHash", "tx_hash", "transactionHash", "hash"];

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function pickBoolean(record: UnknownRecord, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function pickString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export function buildUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

export async function requestJson(
  url: string,
  options: RequestInit
): Promise<unknown> {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  let data: unknown = null;

  if (bodyText.length > 0) {
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error("Upstream returned invalid JSON");
    }
  }

  if (!response.ok) {
    throw new Error(`Upstream error (${response.status})`);
  }

  return data;
}

export function normalizeSupportedResponse(raw: unknown): SupportedResponse {
  const record = asRecord(raw);
  const schemesRaw = record.schemes;
  if (!Array.isArray(schemesRaw)) {
    throw new Error("Unexpected supported response");
  }

  const schemes = schemesRaw.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid supported entry");
    }
    const scheme = (entry as UnknownRecord).scheme;
    if (typeof scheme !== "string" || scheme.length === 0) {
      throw new Error("Invalid supported scheme");
    }
    const networksRaw = (entry as UnknownRecord).networks;
    const networks = Array.isArray(networksRaw)
      ? networksRaw.filter((network) => typeof network === "string")
      : typeof networksRaw === "string"
        ? [networksRaw]
        : [];

    return { scheme, networks };
  });

  return { schemes, rawProvider: raw };
}

export function normalizeVerifyResponse(raw: unknown): VerifyResNormalized {
  const record = asRecord(raw);
  const isValid = pickBoolean(record, VERIFY_BOOL_KEYS);

  if (typeof isValid !== "boolean") {
    throw new Error("Unexpected verify response");
  }

  return {
    isValid,
    payer: pickString(record, PAYER_KEYS),
    invalidReason: pickString(record, INVALID_KEYS),
    rawProvider: raw,
  };
}

export function normalizeSettleResponse(raw: unknown): SettleResNormalized {
  const record = asRecord(raw);
  const success = pickBoolean(record, SETTLE_BOOL_KEYS);

  if (typeof success !== "boolean") {
    throw new Error("Unexpected settle response");
  }

  return {
    success,
    payer: pickString(record, PAYER_KEYS),
    txHash: pickString(record, TX_HASH_KEYS),
    network: pickString(record, ["network"]),
    errorReason: pickString(record, SETTLE_ERROR_KEYS),
    rawProvider: raw,
  };
}
