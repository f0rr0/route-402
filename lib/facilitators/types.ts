import type { SettleReq, SettleResNormalized, VerifyReq, VerifyResNormalized } from "@/lib/types/x402";
import type { FacilitatorProvider } from "@/lib/types/credentials";

export type AdapterCtx = {
  projectId: string;
  connectionId: string;
  provider: FacilitatorProvider;
  credentials: Record<string, unknown>;
};

export type SupportedResponse = {
  schemes: Array<{ scheme: string; networks: string[] }>;
  rawProvider?: unknown;
};

export interface FacilitatorAdapter {
  provider: FacilitatorProvider;
  supported(ctx: AdapterCtx): Promise<SupportedResponse>;
  verify(ctx: AdapterCtx, req: VerifyReq): Promise<VerifyResNormalized>;
  settle(ctx: AdapterCtx, req: SettleReq): Promise<SettleResNormalized>;
}
