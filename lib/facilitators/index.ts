import type { FacilitatorAdapter } from "./types";
import { cdpAdapter } from "./cdp";
import { thirdwebAdapter } from "./thirdweb";
import { mogamiAdapter } from "./mogami";
import type { FacilitatorProvider } from "@/lib/types/credentials";

const adapters: Record<FacilitatorProvider, FacilitatorAdapter> = {
  cdp: cdpAdapter,
  thirdweb: thirdwebAdapter,
  mogami: mogamiAdapter,
};

export function getAdapter(provider: FacilitatorProvider) {
  return adapters[provider];
}
