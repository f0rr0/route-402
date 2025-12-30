"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { authorizeOrRedirect } from "@/lib/rbac/authorize";
import { db } from "@/lib/db";
import { routingRulesets } from "@/lib/db/schema";
import { buildRoutingContext } from "@/lib/routing/context";
import { parseRulesetYaml, RoutingRulesetError } from "@/lib/routing/dsl";
import { evaluateRuleset } from "@/lib/routing/eval";
import type { RoutingDecision, RoutingEndpoint } from "@/lib/routing/types";

const rulesetInputSchema = z.object({
  projectId: z.string().uuid(),
  yamlText: z.string().min(1),
});

const dryRunSchema = rulesetInputSchema.extend({
  endpoint: z.enum(["verify", "settle"]),
  requirementsJson: z.string().min(1),
});

const paymentRequirementsSchema = z.object({
  scheme: z.string().min(1),
  network: z.string().optional(),
  asset: z.string().optional(),
  amount: z.string().optional(),
  payTo: z.string().optional(),
});

export type ValidateRulesetResult =
  | {
      ok: true;
      summary: {
        defaultConnection: string;
        ruleCount: number;
      };
    }
  | {
      ok: false;
      errors: string[];
    };

export type DryRunRulesetResult =
  | {
      ok: true;
      decision: RoutingDecision;
      context: ReturnType<typeof buildRoutingContext>;
    }
  | {
      ok: false;
      errors: string[];
    };

export type SaveRulesetResult =
  | {
      ok: true;
      version: number;
    }
  | {
      ok: false;
      errors: string[];
    };

function formatErrors(error: unknown): string[] {
  if (error instanceof RoutingRulesetError) {
    return error.issues;
  }
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message);
  }
  if (error instanceof Error) {
    return [error.message];
  }
  return ["Unknown error"];
}

export async function validateRulesetAction(
  input: z.infer<typeof rulesetInputSchema>
): Promise<ValidateRulesetResult> {
  const parsed = rulesetInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: formatErrors(parsed.error),
    };
  }

  const requestHeaders = await headers();
  await authorizeOrRedirect({
    headers: requestHeaders,
    projectId: parsed.data.projectId,
    minRole: "viewer",
  });

  try {
    const ruleset = parseRulesetYaml(parsed.data.yamlText);
    return {
      ok: true,
      summary: {
        defaultConnection: ruleset.default,
        ruleCount: ruleset.rules?.length ?? 0,
      },
    };
  } catch (error) {
    return {
      ok: false,
      errors: formatErrors(error),
    };
  }
}

export async function dryRunRulesetAction(
  input: z.infer<typeof dryRunSchema>
): Promise<DryRunRulesetResult> {
  const parsed = dryRunSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: formatErrors(parsed.error),
    };
  }

  const requestHeaders = await headers();
  await authorizeOrRedirect({
    headers: requestHeaders,
    projectId: parsed.data.projectId,
    minRole: "viewer",
  });

  try {
    const ruleset = parseRulesetYaml(parsed.data.yamlText);
    const requirementsRaw = JSON.parse(parsed.data.requirementsJson);
    const requirements = paymentRequirementsSchema.parse(requirementsRaw);
    const context = buildRoutingContext(
      requirements,
      parsed.data.endpoint as RoutingEndpoint
    );
    const decision = evaluateRuleset(ruleset, context);

    return {
      ok: true,
      decision,
      context,
    };
  } catch (error) {
    return {
      ok: false,
      errors: formatErrors(error),
    };
  }
}

export async function saveRulesetAction(
  input: z.infer<typeof rulesetInputSchema>
): Promise<SaveRulesetResult> {
  const parsed = rulesetInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: formatErrors(parsed.error),
    };
  }

  const requestHeaders = await headers();
  const authz = await authorizeOrRedirect({
    headers: requestHeaders,
    projectId: parsed.data.projectId,
    minRole: "admin",
  });

  try {
    parseRulesetYaml(parsed.data.yamlText);

    const latest = await db
      .select({ version: routingRulesets.version })
      .from(routingRulesets)
      .where(eq(routingRulesets.projectId, parsed.data.projectId))
      .orderBy(desc(routingRulesets.version))
      .limit(1);

    const nextVersion = (latest[0]?.version ?? 0) + 1;

    await db
      .update(routingRulesets)
      .set({ enabled: false })
      .where(eq(routingRulesets.projectId, parsed.data.projectId));

    await db.insert(routingRulesets).values({
      projectId: parsed.data.projectId,
      version: nextVersion,
      yamlText: parsed.data.yamlText.trim(),
      enabled: true,
      createdBy: authz.userId,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      version: nextVersion,
    };
  } catch (error) {
    return {
      ok: false,
      errors: formatErrors(error),
    };
  }
}
