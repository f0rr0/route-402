export type RoutingEndpoint = "verify" | "settle";

export type RoutingContext = {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  endpoint: RoutingEndpoint;
};

export type RoutingRule = {
  name: string;
  when: unknown;
  then: {
    use: string;
  };
};

export type RoutingRuleset = {
  version?: number;
  default: string;
  rules?: RoutingRule[];
};

export type RoutingDecision = {
  connectionName: string;
  ruleName: string;
};
