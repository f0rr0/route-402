import type { FacilitatorAdapter } from "./types";
import { thirdwebCredentialsSchema } from "@/lib/types/credentials";
import {
  buildUrl,
  normalizeSettleResponse,
  normalizeSupportedResponse,
  normalizeVerifyResponse,
  requestJson,
} from "@/lib/facilitators/utils";

const DEFAULT_BASE_URL = "https://api.thirdweb.com";

export const thirdwebAdapter: FacilitatorAdapter = {
  provider: "thirdweb",
  async supported(ctx) {
    const credentials = thirdwebCredentialsSchema.parse(ctx.credentials);
    const baseUrl = credentials.baseUrl ?? DEFAULT_BASE_URL;

    const raw = await requestJson(
      buildUrl(baseUrl, "/v1/payments/x402/supported"),
      {
        method: "GET",
        headers: {
          "x-secret-key": credentials.walletSecret,
          Accept: "application/json",
        },
      }
    );

    return normalizeSupportedResponse(raw);
  },
  async verify(ctx, req) {
    const credentials = thirdwebCredentialsSchema.parse(ctx.credentials);
    const baseUrl = credentials.baseUrl ?? DEFAULT_BASE_URL;

    const raw = await requestJson(
      buildUrl(baseUrl, "/v1/payments/x402/verify"),
      {
        method: "POST",
        headers: {
          "x-secret-key": credentials.walletSecret,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(req),
      }
    );

    return normalizeVerifyResponse(raw);
  },
  async settle(ctx, req) {
    const credentials = thirdwebCredentialsSchema.parse(ctx.credentials);
    const baseUrl = credentials.baseUrl ?? DEFAULT_BASE_URL;

    const raw = await requestJson(
      buildUrl(baseUrl, "/v1/payments/x402/settle"),
      {
        method: "POST",
        headers: {
          "x-secret-key": credentials.walletSecret,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(req),
      }
    );

    return normalizeSettleResponse(raw);
  },
};
