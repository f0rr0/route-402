import type { RoutingContext, RoutingDecision, RoutingRuleset } from "./types";

export function evaluateRuleset(
  ruleset: RoutingRuleset,
  _context: RoutingContext
): RoutingDecision {
  return {
    connectionName: ruleset.default,
    ruleName: "default",
  };
}
