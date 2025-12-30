import type { FacilitatorAdapter } from "./types";
import { mogamiCredentialsSchema } from "@/lib/types/credentials";
import {
  buildUrl,
  normalizeSettleResponse,
  normalizeSupportedResponse,
  normalizeVerifyResponse,
} from "@/lib/facilitators/utils";
import { env } from "@/lib/env";

const DEFAULT_BASE_URL = "https://v1.facilitator.mogami.tech";
const DEFAULT_SCHEME = "exact";
const DEFAULT_NETWORKS = ["base-sepolia"];

const VERIFY_TIMEOUT_MS = 5000;
const SUPPORTED_TIMEOUT_MS = 5000;
const SETTLE_TIMEOUT_MS = 25000;

const JSON_HEADERS = {
  Accept: "application/json",
};

function resolveBaseUrl(credentials: unknown) {
  const parsed = mogamiCredentialsSchema.parse(credentials);
  return parsed.baseUrl ?? env.MOGAMI_BASE_URL ?? DEFAULT_BASE_URL;
}

async function fetchJsonWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
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
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOkWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Upstream error (${response.status})`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === "AbortError") {
    return true;
  }
  const message = error.message.toLowerCase();
  return message.includes("fetch") || message.includes("network");
}

async function requestJsonWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  retries: number
) {
  let attempt = 0;
  while (true) {
    try {
      return await fetchJsonWithTimeout(url, options, timeoutMs);
    } catch (error) {
      if (attempt < retries && isNetworkError(error)) {
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}

export const mogamiAdapter: FacilitatorAdapter = {
  provider: "mogami",
  async supported(ctx) {
    const baseUrl = resolveBaseUrl(ctx.credentials);
    const supportedUrl = buildUrl(baseUrl, "/supported");

    try {
      const raw = await fetchJsonWithTimeout(
        supportedUrl,
        { method: "GET", headers: JSON_HEADERS },
        SUPPORTED_TIMEOUT_MS
      );
      return normalizeSupportedResponse(raw);
    } catch {
      const supportUrl = buildUrl(baseUrl, "/support");
      await fetchOkWithTimeout(
        supportUrl,
        { method: "GET", headers: JSON_HEADERS },
        SUPPORTED_TIMEOUT_MS
      );

      return {
        schemes: [
          {
            scheme: DEFAULT_SCHEME,
            networks: DEFAULT_NETWORKS,
          },
        ],
        rawProvider: { source: "fallback" },
      };
    }
  },
  async verify(ctx, req) {
    const baseUrl = resolveBaseUrl(ctx.credentials);
    const raw = await requestJsonWithRetry(
      buildUrl(baseUrl, "/verify"),
      {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
      },
      VERIFY_TIMEOUT_MS,
      1
    );

    return normalizeVerifyResponse(raw);
  },
  async settle(ctx, req) {
    const baseUrl = resolveBaseUrl(ctx.credentials);
    const raw = await fetchJsonWithTimeout(
      buildUrl(baseUrl, "/settle"),
      {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
      },
      SETTLE_TIMEOUT_MS
    );

    return normalizeSettleResponse(raw);
  },
};
