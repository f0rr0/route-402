import type { SettleReq, SettleResNormalized, VerifyReq, VerifyResNormalized } from "@/lib/types/x402";

export type AdapterCtx = {
  projectId: string;
  connectionId: string;
  provider: "cdp" | "thirdweb";
  credentials: Record<string, unknown>;
};

export type SupportedResponse = {
  schemes: Array<{ scheme: string; networks: string[] }>;
  rawProvider?: unknown;
};

export interface FacilitatorAdapter {
  provider: "cdp" | "thirdweb";
  supported(ctx: AdapterCtx): Promise<SupportedResponse>;
  verify(ctx: AdapterCtx, req: VerifyReq): Promise<VerifyResNormalized>;
  settle(ctx: AdapterCtx, req: SettleReq): Promise<SettleResNormalized>;
}
