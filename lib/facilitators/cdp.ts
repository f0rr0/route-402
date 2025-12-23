import { createPrivateKey, randomBytes, sign } from "crypto";
import type { FacilitatorAdapter } from "./types";
import { cdpCredentialsSchema } from "@/lib/types/credentials";
import {
  buildUrl,
  normalizeSettleResponse,
  normalizeSupportedResponse,
  normalizeVerifyResponse,
  requestJson,
} from "@/lib/facilitators/utils";

const DEFAULT_BASE_URL = "https://api.cdp.coinbase.com";
const API_PREFIX = "/platform/v2/x402";
const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex"
);

function base64UrlEncode(value: string | Buffer) {
  return Buffer.isBuffer(value)
    ? value.toString("base64url")
    : Buffer.from(value).toString("base64url");
}

function decodeKeySecret(secret: string) {
  const normalized = secret
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(secret.length + ((4 - (secret.length % 4)) % 4), "=");

  return Buffer.from(normalized, "base64");
}

function createEd25519Key(secret: string) {
  const decoded = decodeKeySecret(secret);
  if (decoded.length !== 64) {
    throw new Error("Invalid CDP key secret length");
  }

  const seed = decoded.subarray(0, 32);
  const key = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);

  return createPrivateKey({ key, format: "der", type: "pkcs8" });
}

function signCdpJwt(params: {
  keyName: string;
  keySecret: string;
  method: string;
  url: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const parsedUrl = new URL(params.url);
  const pathWithQuery = `${parsedUrl.pathname}${parsedUrl.search}`;
  const uri = `${params.method.toUpperCase()} ${parsedUrl.host}${pathWithQuery}`;

  const header = {
    alg: "EdDSA",
    typ: "JWT",
    kid: params.keyName,
    nonce: randomBytes(16).toString("hex"),
  };

  const payload = {
    sub: params.keyName,
    iss: "cdp",
    aud: ["cdp_service"],
    nbf: now,
    exp: now + 120,
    uri,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(null, Buffer.from(data), createEd25519Key(params.keySecret));

  return `${data}.${base64UrlEncode(signature)}`;
}

export const cdpAdapter: FacilitatorAdapter = {
  provider: "cdp",
  async supported(ctx) {
    const credentials = cdpCredentialsSchema.parse(ctx.credentials);
    const baseUrl = credentials.baseUrl ?? DEFAULT_BASE_URL;
    const url = buildUrl(baseUrl, `${API_PREFIX}/supported`);
    const token = signCdpJwt({
      keyName: credentials.apiKey,
      keySecret: credentials.apiSecret,
      method: "GET",
      url,
    });

    const raw = await requestJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    return normalizeSupportedResponse(raw);
  },
  async verify(ctx, req) {
    const credentials = cdpCredentialsSchema.parse(ctx.credentials);
    const baseUrl = credentials.baseUrl ?? DEFAULT_BASE_URL;
    const url = buildUrl(baseUrl, `${API_PREFIX}/verify`);
    const token = signCdpJwt({
      keyName: credentials.apiKey,
      keySecret: credentials.apiSecret,
      method: "POST",
      url,
    });

    const raw = await requestJson(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(req),
    });

    return normalizeVerifyResponse(raw);
  },
  async settle(ctx, req) {
    const credentials = cdpCredentialsSchema.parse(ctx.credentials);
    const baseUrl = credentials.baseUrl ?? DEFAULT_BASE_URL;
    const url = buildUrl(baseUrl, `${API_PREFIX}/settle`);
    const token = signCdpJwt({
      keyName: credentials.apiKey,
      keySecret: credentials.apiSecret,
      method: "POST",
      url,
    });

    const raw = await requestJson(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(req),
    });

    return normalizeSettleResponse(raw);
  },
};
