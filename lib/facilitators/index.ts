import type { FacilitatorAdapter } from "./types";
import { cdpAdapter } from "./cdp";
import { thirdwebAdapter } from "./thirdweb";
import type { FacilitatorProvider } from "@/lib/types/credentials";

const adapters: Record<FacilitatorProvider, FacilitatorAdapter> = {
  cdp: cdpAdapter,
  thirdweb: thirdwebAdapter,
};

export function getAdapter(provider: FacilitatorProvider) {
  return adapters[provider];
}
