import { z } from "zod";
import YAML from "yaml";
import {
  type CompiledRoutingRuleset,
  type RoutingExpressionInput,
  type RoutingExpressionNode,
  type RoutingRuleset,
  routingContextKeys,
} from "./types";

const contextKeySchema = z.enum(routingContextKeys);
const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const numericSchema = z
  .union([z.number(), z.string()])
  .refine((value) => Number.isFinite(Number(value)), {
    message: "Value must be a number",
  });

const expressionSchema: z.ZodType<RoutingExpressionInput> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(expressionSchema).min(1) }).strict(),
    z.object({ any: z.array(expressionSchema).min(1) }).strict(),
    z.object({ not: expressionSchema }).strict(),
    z.object({ eq: z.tuple([contextKeySchema, scalarSchema]) }).strict(),
    z.object({ in: z.tuple([contextKeySchema, z.array(scalarSchema).min(1)]) }).strict(),
    z.object({ lte: z.tuple([contextKeySchema, numericSchema]) }).strict(),
    z.object({ gte: z.tuple([contextKeySchema, numericSchema]) }).strict(),
  ])
);

const ruleSchema = z
  .object({
    name: z.string().min(1),
    when: expressionSchema,
    then: z
      .object({
        use: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const rulesetSchema = z
  .object({
    version: z.number().int().optional(),
    default: z.string().min(1),
    rules: z.array(ruleSchema).optional(),
  })
  .strict();

export class RoutingRulesetError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(message);
    this.issues = issues;
  }
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "ruleset";
    return `${path}: ${issue.message}`;
  });
}

export function parseRulesetYaml(yamlText: string): RoutingRuleset {
  if (!yamlText.trim()) {
    throw new RoutingRulesetError("Ruleset is empty", [
      "ruleset: YAML input is empty",
    ]);
  }

  let raw: unknown;
  try {
    raw = YAML.parse(yamlText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid YAML input";
    throw new RoutingRulesetError("Invalid YAML", [message]);
  }

  const parsed = rulesetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RoutingRulesetError(
      "Ruleset validation failed",
      formatZodIssues(parsed.error)
    );
  }

  const rules = parsed.data.rules ?? [];
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const rule of rules) {
    if (seen.has(rule.name)) {
      duplicates.push(`rules[].name: duplicate rule name "${rule.name}"`);
      continue;
    }
    seen.add(rule.name);
  }

  if (duplicates.length) {
    throw new RoutingRulesetError("Duplicate rule names", duplicates);
  }

  return {
    version: parsed.data.version,
    default: parsed.data.default,
    rules,
  };
}

export function compileRuleset(ruleset: RoutingRuleset): CompiledRoutingRuleset {
  return {
    version: ruleset.version,
    default: ruleset.default,
    rules: (ruleset.rules ?? []).map((rule) => ({
      name: rule.name,
      use: rule.then.use,
      when: compileExpression(rule.when),
    })),
  };
}

function compileExpression(input: RoutingExpressionInput): RoutingExpressionNode {
  if ("all" in input) {
    return { type: "all", nodes: input.all.map(compileExpression) };
  }
  if ("any" in input) {
    return { type: "any", nodes: input.any.map(compileExpression) };
  }
  if ("not" in input) {
    return { type: "not", node: compileExpression(input.not) };
  }
  if ("eq" in input) {
    return {
      type: "predicate",
      op: "eq",
      key: input.eq[0],
      value: input.eq[1],
    };
  }
  if ("in" in input) {
    return {
      type: "predicate",
      op: "in",
      key: input.in[0],
      value: input.in[1],
    };
  }
  if ("lte" in input) {
    return {
      type: "predicate",
      op: "lte",
      key: input.lte[0],
      value: input.lte[1],
    };
  }
  return {
    type: "predicate",
    op: "gte",
    key: input.gte[0],
    value: input.gte[1],
  };
}
