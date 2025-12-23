export type RoutingEndpoint = "verify" | "settle";

export const routingContextKeys = [
  "scheme",
  "network",
  "asset",
  "amount",
  "payTo",
  "endpoint",
] as const;

export type RoutingContextKey = (typeof routingContextKeys)[number];

export type RoutingContext = {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  endpoint: RoutingEndpoint;
};

export type RoutingValue = string | number | boolean;

export type RoutingExpressionInput =
  | { all: RoutingExpressionInput[] }
  | { any: RoutingExpressionInput[] }
  | { not: RoutingExpressionInput }
  | { eq: [RoutingContextKey, RoutingValue] }
  | { in: [RoutingContextKey, RoutingValue[]] }
  | { lte: [RoutingContextKey, RoutingValue] }
  | { gte: [RoutingContextKey, RoutingValue] };

export type RoutingRule = {
  name: string;
  when: RoutingExpressionInput;
  then: {
    use: string;
  };
};

export type RoutingRuleset = {
  version?: number;
  default: string;
  rules?: RoutingRule[];
};

export type RoutingPredicateOp = "eq" | "in" | "lte" | "gte";

export type RoutingPredicateNode = {
  type: "predicate";
  op: RoutingPredicateOp;
  key: RoutingContextKey;
  value: RoutingValue | RoutingValue[];
};

export type RoutingBooleanNode =
  | { type: "all"; nodes: RoutingExpressionNode[] }
  | { type: "any"; nodes: RoutingExpressionNode[] }
  | { type: "not"; node: RoutingExpressionNode };

export type RoutingExpressionNode = RoutingPredicateNode | RoutingBooleanNode;

export type CompiledRoutingRule = {
  name: string;
  use: string;
  when: RoutingExpressionNode;
};

export type CompiledRoutingRuleset = {
  version?: number;
  default: string;
  rules: CompiledRoutingRule[];
};

export type RoutingDecision = {
  connectionName: string;
  ruleName: string;
};
