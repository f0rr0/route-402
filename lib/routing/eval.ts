import type {
  CompiledRoutingRuleset,
  RoutingContext,
  RoutingDecision,
  RoutingExpressionNode,
  RoutingRuleset,
  RoutingValue,
} from "./types";
import { compileRuleset } from "./dsl";

export function evaluateRuleset(
  ruleset: RoutingRuleset,
  context: RoutingContext
): RoutingDecision {
  return evaluateCompiledRuleset(compileRuleset(ruleset), context);
}

export function evaluateCompiledRuleset(
  ruleset: CompiledRoutingRuleset,
  context: RoutingContext
): RoutingDecision {
  for (const rule of ruleset.rules) {
    if (evaluateExpression(rule.when, context)) {
      return {
        connectionName: rule.use,
        ruleName: rule.name,
      };
    }
  }

  return {
    connectionName: ruleset.default,
    ruleName: "default",
  };
}

function evaluateExpression(
  expression: RoutingExpressionNode,
  context: RoutingContext
): boolean {
  switch (expression.type) {
    case "all":
      return expression.nodes.every((node) =>
        evaluateExpression(node, context)
      );
    case "any":
      return expression.nodes.some((node) =>
        evaluateExpression(node, context)
      );
    case "not":
      return !evaluateExpression(expression.node, context);
    case "predicate":
      return evaluatePredicate(expression, context);
    default:
      return false;
  }
}

function evaluatePredicate(
  expression: Extract<RoutingExpressionNode, { type: "predicate" }>,
  context: RoutingContext
): boolean {
  const contextValue = context[expression.key];
  if (contextValue === undefined || contextValue === null) {
    return false;
  }

  if (expression.op === "eq") {
    return normalizeValue(contextValue) === normalizeValue(expression.value);
  }

  if (expression.op === "in") {
    const values = Array.isArray(expression.value) ? expression.value : [];
    return values.some(
      (value) => normalizeValue(contextValue) === normalizeValue(value)
    );
  }

  const left = toNumber(contextValue);
  const right = toNumber(expression.value);
  if (left === null || right === null) {
    return false;
  }

  return expression.op === "lte" ? left <= right : left >= right;
}

function normalizeValue(value: RoutingValue | RoutingValue[]): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join("|");
  }
  return String(value);
}

function toNumber(value: RoutingValue | RoutingValue[]): number | null {
  if (Array.isArray(value)) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
