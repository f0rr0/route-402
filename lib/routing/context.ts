import type { PaymentRequirements } from "@/lib/types/x402";
import type { RoutingContext, RoutingEndpoint } from "./types";

export function buildRoutingContext(
  requirements: PaymentRequirements,
  endpoint: RoutingEndpoint
): RoutingContext {
  return {
    scheme: requirements.scheme,
    network: requirements.network,
    asset: requirements.asset,
    amount: requirements.amount,
    payTo: requirements.payTo,
    endpoint,
  };
}
